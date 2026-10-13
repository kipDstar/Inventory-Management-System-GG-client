const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const path = require('path');
const http = require('http');
const db = require('./db');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const authenticatedUsers = new Map();
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const LOW_STOCK_THRESHOLD = 3;
const VAT_RATE_BASIS_POINTS = 1600;
let callbackServer;

if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => authenticatedUsers.delete(mainWindow.webContents.id));
  const rendererOrigin = new URL(MAIN_WINDOW_WEBPACK_ENTRY).origin;
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (navigationEvent, destination) => {
    if (new URL(destination).origin !== rendererOrigin) navigationEvent.preventDefault();
  });
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged && process.env.IMS_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools();
  }
}

function currentUser(event, allowPasswordChange = false) {
  const user = authenticatedUsers.get(event.sender.id);
  if (!user) throw new Error('Please sign in to continue.');
  if (user.mustChangePassword && !allowPasswordChange) {
    throw new Error('Change your temporary password before using the system.');
  }
  return user;
}

function requireRole(event, roles) {
  const user = currentUser(event);
  if (!roles.includes(user.role)) {
    throw new Error('Your account is not permitted to perform this action.');
  }
  return user;
}

async function activeShift(userId, query = db) {
  return query.getAsync
    ? query.getAsync(
      'SELECT * FROM shifts WHERE user_id = ? AND check_out IS NULL ORDER BY id DESC LIMIT 1',
      [userId],
    )
    : query.get(
      'SELECT * FROM shifts WHERE user_id = ? AND check_out IS NULL ORDER BY id DESC LIMIT 1',
      [userId],
    );
}

async function requireActiveShift(user) {
  if (user.role !== 'sales') {
    throw new Error('Sales can only be recorded by a sales account.');
  }
  const shift = await activeShift(user.id);
  if (!shift) throw new Error('Check in to an active shift before making a sale.');
  return shift;
}

function toCents(value, fieldName) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000000) {
    throw new Error(`${fieldName} must be a valid non-negative amount.`);
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

function receiptBusiness() {
  return {
    name: process.env.IMS_BUSINESS_NAME || 'GG Liquor Shop',
    kraPin: process.env.IMS_KRA_PIN || '',
  };
}

function nairobiDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`;
}

function cleanText(value, fieldName, maxLength = 120) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new Error(`${fieldName} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not read a stored JSON array:', error);
    return [];
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error('Could not read stored event details:', error);
    return {};
  }
}

function receiptCode(value) {
  const code = cleanText(value, 'M-Pesa receipt code', 32).toUpperCase();
  if (!/^[A-Z0-9]{8,32}$/.test(code)) {
    throw new Error('Enter the M-Pesa confirmation code exactly as shown on the receipt.');
  }
  return code;
}

function darajaConfiguration() {
  const {
    MPESA_CONSUMER_KEY: consumerKey,
    MPESA_CONSUMER_SECRET: consumerSecret,
    MPESA_SHORTCODE: shortcode,
    MPESA_PASSKEY: passkey,
    MPESA_CALLBACK_URL: callbackUrl,
  } = process.env;

  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    throw new Error('M-Pesa STK Push is not configured. Ask the administrator to configure Daraja sandbox credentials and a public HTTPS callback URL.');
  }
  const parsedCallback = new URL(callbackUrl);
  if (parsedCallback.protocol !== 'https:' || !parsedCallback.pathname.endsWith('/mpesa/callback')) {
    throw new Error('The Daraja callback URL must be HTTPS and end in /mpesa/callback.');
  }

  return { consumerKey, consumerSecret, shortcode, passkey, callbackUrl };
}

function darajaTimestamp() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()).replace(/\D/g, '');
}

async function sendStkPush({ phoneNumber, amountCents, accountReference }) {
  const config = darajaConfiguration();
  const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
  if (!['sandbox', 'production'].includes(environment)) {
    throw new Error('MPESA_ENVIRONMENT must be either sandbox or production.');
  }
  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  const tokenResponse = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!tokenResponse.ok) throw new Error('Daraja authentication failed. Check the configured API credentials.');
  const tokenBody = await tokenResponse.json();
  if (typeof tokenBody.access_token !== 'string') {
    throw new Error('Daraja did not return an access token.');
  }

  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64');
  const pushResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amountCents / 100,
      PartyA: phoneNumber,
      PartyB: config.shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: config.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: 'GG IMS sale',
    }),
  });
  const pushBody = await pushResponse.json().catch(() => null);
  if (!pushResponse.ok || !pushBody?.CheckoutRequestID) {
    throw new Error(pushBody?.errorMessage || pushBody?.ResponseDescription || 'Daraja could not start the STK Push.');
  }
  return {
    checkoutRequestId: pushBody.CheckoutRequestID,
    merchantRequestId: pushBody.MerchantRequestID || null,
    responseDescription: pushBody.ResponseDescription || 'STK Push sent to customer.',
  };
}

async function audit(tx, actorId, shiftId, eventType, entityType, entityId, details = {}) {
  await tx.run(
    `INSERT INTO audit_events
      (actor_id, shift_id, event_type, entity_type, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [actorId || null, shiftId || null, eventType, entityType, entityId == null ? null : String(entityId),
      JSON.stringify(details), new Date().toISOString()],
  );
}

async function getOrCreateCategory(tx, categoryName) {
  await tx.run('INSERT INTO categories (name) VALUES (?) ON CONFLICT(name) DO NOTHING', [categoryName]);
  return (await tx.get('SELECT id FROM categories WHERE name = ?', [categoryName])).id;
}

async function getOrCreateSubcategory(tx, subcategoryName, categoryId) {
  let row = await tx.get(
    'SELECT id FROM subcategories WHERE name = ? AND category_id = ? ORDER BY id LIMIT 1',
    [subcategoryName, categoryId],
  );
  if (!row) {
    const created = await tx.run(
      'INSERT INTO subcategories (name, category_id) VALUES (?, ?)',
      [subcategoryName, categoryId],
    );
    row = { id: created.lastID };
  }
  return row.id;
}

async function inventoryRows(tx, barcodes) {
  const placeholders = barcodes.map(() => '?').join(',');
  return tx.all(
    `SELECT items.id, items.barcode, items.price_buy, items.price_sell,
            items.buying_price, items.selling_price, items.discount,
            items.tax_rate_basis_points,
            items.image_path, categories.name AS category, subcategories.name AS subcategory
     FROM items
     LEFT JOIN subcategories ON subcategories.id = items.subcategory_id
     LEFT JOIN categories ON categories.id = subcategories.category_id
     WHERE items.barcode IN (${placeholders}) AND items.status = 'in_stock'
     ORDER BY items.id`,
    barcodes,
  );
}

function saleSnapshot(row) {
  const priceBuy = Number(row.price_buy) > 0 ? row.price_buy : row.buying_price ?? row.price_buy ?? 0;
  const priceSell = Number(row.price_sell) > 0 ? row.price_sell : row.selling_price ?? row.price_sell ?? 0;
  const priceBuyCents = toCents(priceBuy, 'Buying price');
  const priceSellCents = toCents(priceSell, 'Selling price');
  const discountPercent = Math.min(100, Math.max(0, Number(row.discount) || 0));
  const unitTotalCents = Math.round(priceSellCents * (1 - discountPercent / 100));
  if (priceBuyCents < 1 || priceSellCents < 1) {
    throw new Error(`Item ${row.barcode} needs valid buying and selling prices before it can be sold.`);
  }
  if (unitTotalCents < priceBuyCents) {
    throw new Error(`The discounted price for ${row.barcode} is below its recorded cost.`);
  }
  const taxRateBasisPoints = Number.isInteger(row.tax_rate_basis_points)
    ? row.tax_rate_basis_points
    : VAT_RATE_BASIS_POINTS;
  const taxDenominator = 10000 + taxRateBasisPoints;
  const taxTotalCents = taxRateBasisPoints > 0
    ? Math.round(unitTotalCents * taxRateBasisPoints / taxDenominator)
    : 0;
  return {
    itemId: row.id,
    barcode: row.barcode,
    category: row.category || 'Uncategorized',
    subcategory: row.subcategory || 'Uncategorized',
    priceBuy: fromCents(priceBuyCents),
    priceSell: fromCents(priceSellCents),
    discount: discountPercent,
    lineTotalCents: unitTotalCents,
    lineTotal: fromCents(unitTotalCents),
    taxRateBasisPoints,
    taxableAmountCents: unitTotalCents - taxTotalCents,
    vatAmountCents: taxTotalCents,
  };
}

async function createSale(tx, user, shift, rows, payment) {
  const lines = rows.map(saleSnapshot);
  const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const totalCostCents = lines.reduce((sum, line) => sum + toCents(line.priceBuy, 'Buying price'), 0);
  const taxableAmountCents = lines.reduce((sum, line) => sum + line.taxableAmountCents, 0);
  const taxTotalCents = lines.reduce((sum, line) => sum + line.vatAmountCents, 0);
  const grossProfitCents = taxableAmountCents - totalCostCents;
  const business = receiptBusiness();
  if (totalCents <= 0) throw new Error('The sale total must be greater than zero.');

  for (const line of lines) {
    const update = await tx.run(
      payment.pendingPaymentId
        ? `UPDATE items SET status = 'sold', pending_payment_id = NULL
           WHERE id = ? AND status = 'pending_payment' AND pending_payment_id = ?`
        : `UPDATE items SET status = 'sold'
           WHERE id = ? AND status = 'in_stock'`,
      payment.pendingPaymentId
        ? [line.itemId, payment.pendingPaymentId]
        : [line.itemId],
    );
    if (update.changes !== 1) {
      throw new Error(`Item ${line.barcode} is no longer available. Refresh the sale and try again.`);
    }
  }

  const createdAt = new Date().toISOString();
  const insert = await tx.run(
    `INSERT INTO sales
      (user_id, shift, items, payment_method, created_at, special, failed_barcodes,
       shift_id, total_amount_cents, total_cost_cents, gross_profit_cents,
       taxable_amount_cents, tax_total_cents, tax_rate_basis_points,
       customer_name, receipt_business_snapshot, payment_reference, payment_status,
       mpesa_checkout_id, mpesa_receipt)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.shift || null, JSON.stringify(lines), payment.method, createdAt,
      payment.method === 'mpesa' ? 1 : 0, shift.id, totalCents, totalCostCents,
      grossProfitCents, taxableAmountCents, taxTotalCents,
      VAT_RATE_BASIS_POINTS, payment.customerName || null, JSON.stringify(business),
      payment.reference || null, payment.status, payment.checkoutRequestId || null,
      payment.reference || null],
  );
  await tx.run(
    `INSERT INTO stock_movements
      (actor_id, shift_id, movement_type, quantity, item_barcodes, unit_cost_cents, created_at)
     VALUES (?, ?, 'sale', ?, ?, ?, ?)`,
    [user.id, shift.id, -lines.length, JSON.stringify(lines.map((line) => line.barcode)),
      lines.length ? Math.round(totalCostCents / lines.length) : 0, createdAt],
  );
  await audit(tx, user.id, shift.id, 'sale.completed', 'sale', insert.lastID, {
    itemCount: lines.length,
    totalAmountCents: totalCents,
    paymentMethod: payment.method,
    paymentStatus: payment.status,
    reference: payment.reference || null,
  });
  return {
    id: insert.lastID,
    totalAmountCents: totalCents,
    totalCostCents,
    grossProfitCents,
    taxableAmountCents,
    taxTotalCents,
    taxRateBasisPoints: VAT_RATE_BASIS_POINTS,
    total: fromCents(totalCents),
    lines,
    userName: user.name,
    paymentMethod: payment.method,
    paymentReference: payment.reference || null,
    paymentStatus: payment.status,
    customerName: payment.customerName || null,
    createdAt,
    business,
  };
}

function normalizeSale(row) {
  const items = parseJsonArray(row.items);
  const legacyUnverified = row.payment_status === 'legacy_unverified';
  const calculatedCents = items.reduce((sum, item) => {
    if (Number.isInteger(item.lineTotalCents)) return sum + item.lineTotalCents;
    if (Number.isFinite(Number(item.priceSell))) {
      return sum + toCents(item.priceSell, 'Sale price');
    }
    return sum;
  }, 0);
  const totalAmountCents = legacyUnverified ? 0 : (row.total_amount_cents || calculatedCents);
  const totalCostCents = legacyUnverified ? 0 : (row.total_cost_cents || items.reduce(
    (sum, item) => sum + (Number.isFinite(Number(item.priceBuy)) ? toCents(item.priceBuy, 'Buying price') : 0),
    0,
  ));
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.userName,
    shift: row.shift,
    shiftId: row.shift_id,
    items,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status || 'completed',
    financialDataComplete: !legacyUnverified,
    paymentReference: row.payment_reference || null,
    mpesaReceipt: row.mpesa_receipt || null,
    createdAt: row.created_at,
    customerName: row.customer_name || null,
    business: row.receipt_business_snapshot
      ? parseJsonObject(row.receipt_business_snapshot)
      : null,
    special: row.special,
    totalAmountCents,
    totalAmount: fromCents(totalAmountCents),
    totalCostCents,
    taxableAmountCents: legacyUnverified ? 0 : (row.taxable_amount_cents || 0),
    taxTotalCents: legacyUnverified ? 0 : (row.tax_total_cents || 0),
    taxRateBasisPoints: row.tax_rate_basis_points ?? VAT_RATE_BASIS_POINTS,
    grossProfitCents: legacyUnverified ? 0 : (row.gross_profit_cents ?? totalAmountCents - totalCostCents),
    failedBarcodes: parseJsonArray(row.failed_barcodes),
  };
}

async function releaseMpesaReservation(tx, paymentId) {
  await tx.run(
    `UPDATE items SET status = 'in_stock', pending_payment_id = NULL
     WHERE status = 'pending_payment' AND pending_payment_id = ?`,
    [paymentId],
  );
}

async function handleDarajaCallback(request, response) {
  if (request.method !== 'POST' || request.url !== '/mpesa/callback') {
    response.writeHead(404).end();
    return;
  }

  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 65536) request.destroy();
  });
  request.on('end', async () => {
    try {
      const callback = JSON.parse(body)?.Body?.stkCallback;
      if (!callback?.CheckoutRequestID) throw new Error('Missing checkout request ID.');

      const metadata = new Map((callback.CallbackMetadata?.Item || []).map((item) => [item.Name, item.Value]));
      const resultCode = Number(callback.ResultCode);
      const payment = await db.getAsync(
        'SELECT * FROM mpesa_payments WHERE checkout_request_id = ?',
        [callback.CheckoutRequestID],
      );
      if (!payment) throw new Error('No matching pending M-Pesa payment.');
      if (payment.status !== 'pending') {
        response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ResultCode":0,"ResultDesc":"Already processed"}');
        return;
      }

      if (resultCode !== 0) {
        await db.transaction(async (tx) => {
          await releaseMpesaReservation(tx, payment.id);
          await tx.run(
            `UPDATE mpesa_payments SET status = 'failed', result_description = ?, updated_at = ?
             WHERE id = ? AND status = 'pending'`,
            [String(callback.ResultDesc || 'Payment was not completed').slice(0, 255),
              new Date().toISOString(), payment.id],
          );
          await audit(tx, payment.user_id, payment.shift_id, 'mpesa.failed', 'mpesa_payment', payment.id, {
            resultCode,
            description: String(callback.ResultDesc || '').slice(0, 255),
          });
        });
      } else {
        const receipt = String(metadata.get('MpesaReceiptNumber') || '').toUpperCase();
        const amount = Number(metadata.get('Amount'));
        if (!/^[A-Z0-9]{8,32}$/.test(receipt) || !Number.isFinite(amount)
          || Math.round(amount * 100) !== payment.amount_cents) {
          throw new Error('The M-Pesa callback amount or receipt did not match the pending payment.');
        }
        const user = await db.getAsync(
          'SELECT id, name, role, shift FROM users WHERE id = ?',
          [payment.user_id],
        );
        const shift = await db.getAsync('SELECT * FROM shifts WHERE id = ?', [payment.shift_id]);
        if (!user || !shift) throw new Error('The pending payment has no valid staff shift.');
        const finalized = await db.transaction(async (tx) => {
          const duplicate = await tx.get(
            `SELECT id FROM sales WHERE payment_reference = ?
             UNION ALL
             SELECT id FROM mpesa_payments WHERE receipt_code = ? AND id != ?
             LIMIT 1`,
            [receipt, receipt, payment.id],
          );
          if (duplicate) {
            await releaseMpesaReservation(tx, payment.id);
            await tx.run(
              `UPDATE mpesa_payments SET status = 'review_required',
                 result_description = ?, updated_at = ?
               WHERE id = ? AND status = 'pending'`,
              ['Receipt code was already recorded on another transaction.',
                new Date().toISOString(), payment.id],
            );
            await audit(tx, payment.user_id, payment.shift_id, 'mpesa.receipt_review_required',
              'mpesa_payment', payment.id, { receipt });
            return false;
          }
          const lines = parseJsonArray(payment.items_snapshot);
          const sale = await createSale(tx, user, shift, lines, {
            method: 'mpesa',
            status: 'confirmed',
            reference: receipt,
            checkoutRequestId: payment.checkout_request_id,
            pendingPaymentId: payment.id,
          });
          await tx.run(
            `UPDATE mpesa_payments SET status = 'confirmed', receipt_code = ?, sale_id = ?,
               result_description = ?, updated_at = ?
             WHERE id = ? AND status = 'pending'`,
            [receipt, sale.id, String(callback.ResultDesc || 'Payment confirmed').slice(0, 255),
              new Date().toISOString(), payment.id],
          );
          return true;
        });
        if (!finalized) {
          response.writeHead(200, { 'Content-Type': 'application/json' })
            .end('{"ResultCode":0,"ResultDesc":"Receipt requires reconciliation"}');
          return;
        }
      }
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ResultCode":0,"ResultDesc":"Accepted"}');
    } catch (error) {
      console.error('Daraja callback processing failed:', error.message);
      response.writeHead(400, { 'Content-Type': 'application/json' }).end('{"ResultCode":1,"ResultDesc":"Callback could not be validated"}');
    }
  });
}

function startCallbackServer() {
  if (!process.env.MPESA_CALLBACK_URL) return;
  const port = Number(process.env.MPESA_CALLBACK_PORT || 47851);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error('MPESA_CALLBACK_PORT must be a valid port between 1024 and 65535.');
    return;
  }
  callbackServer = http.createServer(handleDarajaCallback);
  callbackServer.on('error', (error) => {
    console.error('M-Pesa callback listener failed:', error.message);
  });
  callbackServer.listen(port, '127.0.0.1', () => {
    console.log(`M-Pesa callback listener ready on 127.0.0.1:${port}. Configure the public HTTPS callback URL to forward to it.`);
  });
}

function register(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    await db.ready;
    return handler(event, ...args);
  });
}

register('get-setup-status', async (event) => {
  if (!BrowserWindow.fromWebContents(event.sender)) {
    throw new Error('Setup is only available from the desktop application.');
  }
  const row = await db.getAsync('SELECT COUNT(*) AS count FROM users');
  return { success: true, needsSetup: row.count === 0 };
});

register('create-initial-admin', async (event, input = {}) => {
  if (!BrowserWindow.fromWebContents(event.sender)) {
    throw new Error('Administrator setup is only available from the desktop application.');
  }
  const name = cleanText(input.name, 'Administrator username', 80);
  if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) {
    throw new Error('Choose an administrator password between 12 and 128 characters.');
  }
  const user = await db.transaction(async (tx) => {
    const existing = await tx.get('SELECT id FROM users LIMIT 1');
    if (existing) throw new Error('Administrator setup has already been completed.');
    const created = await tx.run(
      `INSERT INTO users (name, role, password_hash, must_change_password)
       VALUES (?, 'admin', ?, 0)`,
      [name, bcrypt.hashSync(input.password, 12)],
    );
    await audit(tx, created.lastID, null, 'system.initialized', 'user', created.lastID);
    return { id: created.lastID, name, role: 'admin', shift: null, mustChangePassword: false };
  });
  authenticatedUsers.set(event.sender.id, user);
  return { success: true, user };
});

register('login', async (event, username, password) => {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const now = Date.now();
  const attempt = loginAttempts.get(event.sender.id) || { count: 0, startedAt: now };
  if (now - attempt.startedAt > LOGIN_WINDOW_MS) {
    attempt.count = 0;
    attempt.startedAt = now;
  }
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    return { success: false, error: 'Too many attempts. Wait 15 minutes and try again.' };
  }
  if (normalizedUsername.length > 80 || typeof password !== 'string' || password.length > 128) {
    attempt.count += 1;
    loginAttempts.set(event.sender.id, attempt);
    return { success: false, error: 'Invalid username or password.' };
  }

  const user = await db.getAsync(
    'SELECT id, name, role, password_hash, shift, must_change_password FROM users WHERE name = ?',
    [normalizedUsername],
  );
  if (!user || typeof user.password_hash !== 'string' || !bcrypt.compareSync(password, user.password_hash)) {
    attempt.count += 1;
    loginAttempts.set(event.sender.id, attempt);
    return { success: false, error: 'Invalid username or password.' };
  }
  loginAttempts.delete(event.sender.id);
  const safeUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    shift: user.shift,
    mustChangePassword: Boolean(user.must_change_password),
  };
  authenticatedUsers.set(event.sender.id, safeUser);
  const shift = await activeShift(user.id);
  return { success: true, user: { ...safeUser, activeShift: shift || null } };
});

register('change-password', async (event, input = {}) => {
  const user = currentUser(event, true);
  const password = input.newPassword;
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Choose a password between 12 and 128 characters.');
  }
  const existing = await db.getAsync(
    'SELECT password_hash FROM users WHERE id = ?',
    [user.id],
  );
  if (!existing) throw new Error('The signed-in account could not be found.');
  if (bcrypt.compareSync(password, existing.password_hash)) {
    throw new Error('Your new password must be different from your current password.');
  }
  await db.transaction(async (tx) => {
    await tx.run(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [bcrypt.hashSync(password, 12), user.id],
    );
    await audit(tx, user.id, null, 'account.password_changed', 'user', user.id);
  });
  user.mustChangePassword = false;
  return { success: true };
});

register('logout', async (event) => {
  authenticatedUsers.delete(event.sender.id);
  return { success: true };
});

register('get-shift-status', async (event) => {
  const user = currentUser(event);
  return { success: true, shift: await activeShift(user.id) || null };
});

register('shift-check-in', async (event) => {
  const user = requireRole(event, ['sales']);
  const now = new Date().toISOString();
  const shift = await db.transaction(async (tx) => {
    const existing = await tx.get(
      'SELECT id FROM shifts WHERE user_id = ? AND check_out IS NULL LIMIT 1',
      [user.id],
    );
    if (existing) return null;
    const created = await tx.run(
      'INSERT INTO shifts (user_id, check_in) VALUES (?, ?)',
      [user.id, now],
    );
    await audit(tx, user.id, created.lastID, 'shift.checked_in', 'shift', created.lastID);
    return { id: created.lastID, checkIn: now, checkOut: null };
  });
  return shift
    ? { success: true, shift }
    : { success: false, error: 'You are already checked in.' };
});

register('shift-check-out', async (event) => {
  const user = requireRole(event, ['sales']);
  const now = new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    const shift = await tx.get(
      'SELECT * FROM shifts WHERE user_id = ? AND check_out IS NULL ORDER BY id DESC LIMIT 1',
      [user.id],
    );
    if (!shift) return null;
    const update = await tx.run(
      'UPDATE shifts SET check_out = ? WHERE id = ? AND check_out IS NULL',
      [now, shift.id],
    );
    if (update.changes !== 1) return null;
    await audit(tx, user.id, shift.id, 'shift.checked_out', 'shift', shift.id);
    return shift.id;
  });
  return result ? { success: true, checkOut: now } : { success: false, error: 'No active shift was found.' };
});

register('check-in', async (event, item) => {
  requireRole(event, ['admin', 'owner']);
  const result = await addInventory(event, item || {});
  return result;
});

register('addInventoryItems', async (event, input = {}) => {
  requireRole(event, ['admin', 'owner']);
  return addInventory(event, input);
});

register('update-item-pricing', async (event, input = {}) => {
  const actor = requireRole(event, ['admin', 'owner']);
  const itemId = Number(input.itemId);
  if (!Number.isSafeInteger(itemId) || itemId < 1) throw new Error('Select a valid inventory item.');
  const priceBuyCents = toCents(input.buyingPrice, 'Buying price');
  const priceSellCents = toCents(input.sellingPrice, 'Selling price');
  const discount = Number(input.discount ?? 0);
  if (priceBuyCents < 1 || priceSellCents < 1 || priceSellCents < priceBuyCents) {
    throw new Error('Enter positive prices, with the selling price at least equal to cost.');
  }
  if (!Number.isFinite(discount) || discount < 0 || discount > 100
    || Math.round(priceSellCents * (1 - discount / 100)) < priceBuyCents) {
    throw new Error('Discount must be 0–100% and cannot reduce the selling price below recorded cost.');
  }
  const result = await db.transaction(async (tx) => {
    const current = await tx.get(
      `SELECT id, barcode, price_buy, price_sell, discount
       FROM items WHERE id = ? AND status = 'in_stock'`,
      [itemId],
    );
    if (!current) throw new Error('That item is no longer available in stock.');
    const update = await tx.run(
      `UPDATE items
       SET price_buy = ?, price_sell = ?, buying_price = ?, selling_price = ?, discount = ?,
           tax_rate_basis_points = ?
       WHERE id = ? AND status = 'in_stock'`,
      [fromCents(priceBuyCents), fromCents(priceSellCents),
        fromCents(priceBuyCents), fromCents(priceSellCents), discount,
        VAT_RATE_BASIS_POINTS, itemId],
    );
    if (update.changes !== 1) throw new Error('Inventory pricing was not updated.');
    await audit(tx, actor.id, null, 'inventory.pricing_updated', 'item', itemId, {
      barcode: current.barcode,
      previousBuyingPrice: current.price_buy,
      previousSellingPrice: current.price_sell,
      previousDiscount: current.discount,
      buyingPrice: fromCents(priceBuyCents),
      sellingPrice: fromCents(priceSellCents),
      discount,
      taxRateBasisPoints: VAT_RATE_BASIS_POINTS,
    });
    return true;
  });
  return { success: result };
});

async function addInventory(event, input) {
  const user = currentUser(event);
  const category = cleanText(input.category, 'Category', 80);
  const subcategory = cleanText(input.subcategory, 'Product name', 100);
  const priceBuyCents = toCents(input.buyingPrice ?? input.priceBuy, 'Buying price');
  const priceSellCents = toCents(input.sellingPrice ?? input.priceSell, 'Selling price');
  if (priceBuyCents < 1 || priceSellCents < 1 || priceSellCents < priceBuyCents) {
    throw new Error('Enter positive prices, with the selling price at least equal to cost.');
  }
  const discount = Number(input.discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new Error('Discount must be between 0 and 100 percent.');
  }
  if (Math.round(priceSellCents * (1 - discount / 100)) < priceBuyCents) {
    throw new Error('The discount cannot reduce the selling price below recorded cost.');
  }

  let barcodes = Array.isArray(input.barcodes)
    ? input.barcodes
    : [input.barcode];
  if (Number.isInteger(input.quantity) && input.quantity > 1 && typeof input.barcode === 'string') {
    barcodes = Array.from({ length: input.quantity }, (_, index) => `${input.barcode}-${index + 1}`);
  }
  if (barcodes.length < 1 || barcodes.length > 500) {
    throw new Error('Receive between 1 and 500 items at a time.');
  }
  barcodes = barcodes.map((value) => cleanText(value, 'Barcode', 80));
  if (new Set(barcodes).size !== barcodes.length) {
    throw new Error('Each barcode in a batch must be unique.');
  }

  const receivedAt = new Date().toISOString();
  return db.transaction(async (tx) => {
    const categoryId = await getOrCreateCategory(tx, category);
    const subcategoryId = await getOrCreateSubcategory(tx, subcategory, categoryId);
    const checkedInBy = user.id;
    const received = [];
    for (const barcode of barcodes) {
      const insert = await tx.run(
        `INSERT INTO items
          (subcategory_id, barcode, checked_in_at, price_buy, price_sell, buying_price,
           selling_price, discount, image_path, status, received_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_stock', ?)`,
        [subcategoryId, barcode, receivedAt, fromCents(priceBuyCents), fromCents(priceSellCents),
          fromCents(priceBuyCents), fromCents(priceSellCents), discount,
          typeof input.imagePath === 'string' ? input.imagePath.slice(0, 255) : null, checkedInBy],
      );
      received.push({ id: insert.lastID, barcode });
    }
    await tx.run(
      `INSERT INTO stock_movements
        (actor_id, movement_type, quantity, item_barcodes, unit_cost_cents, created_at)
       VALUES (?, 'receipt', ?, ?, ?, ?)`,
      [checkedInBy, received.length, JSON.stringify(barcodes), priceBuyCents, receivedAt],
    );
    await audit(tx, checkedInBy, null, 'inventory.received', 'inventory_batch', receivedAt, {
      category,
      subcategory,
      quantity: received.length,
      barcodes,
      unitCostCents: priceBuyCents,
    });
    return { success: true, inserted: received.length, failed: 0, items: received };
  });
}

async function listInventory() {
  const rows = await db.allAsync(
    `SELECT items.*, categories.name AS category, subcategories.name AS subcategory
     FROM items
     LEFT JOIN subcategories ON items.subcategory_id = subcategories.id
     LEFT JOIN categories ON subcategories.category_id = categories.id
     WHERE items.status = 'in_stock'
     ORDER BY categories.name, subcategories.name, items.barcode`,
  );
  return rows.map((row) => {
    const priceBuy = Number(row.price_buy) > 0 ? row.price_buy : row.buying_price;
    const priceSell = Number(row.price_sell) > 0 ? row.price_sell : row.selling_price;
    return {
      id: row.id,
      barcode: row.barcode,
      status: row.status,
      priceBuy,
      priceSell,
      buyingPrice: priceBuy,
      sellingPrice: priceSell,
      discount: row.discount || 0,
      checkedInAt: row.checked_in_at,
      category: row.category,
      subcategory: row.subcategory,
      imagePath: row.image_path || null,
      requiresPricingReview: !(Number(priceBuy) > 0) || !(Number(priceSell) > 0),
    };
  });
}

register('get-all-items', async (event) => {
  currentUser(event);
  return { success: true, items: await listInventory() };
});
register('getInventory', async (event) => {
  currentUser(event);
  return { success: true, items: await listInventory() };
});

register('get-item-by-barcode', async (event, rawBarcode) => {
  currentUser(event);
  const barcode = cleanText(rawBarcode, 'Barcode', 80);
  const row = await db.getAsync(
    `SELECT items.*, categories.name AS category, subcategories.name AS subcategory
     FROM items
     LEFT JOIN subcategories ON items.subcategory_id = subcategories.id
     LEFT JOIN categories ON subcategories.category_id = categories.id
     WHERE items.barcode = ? AND items.status = 'in_stock'`,
    [barcode],
  );
  if (!row) return { success: false, error: 'Item is not in stock.' };
  return {
    success: true,
    item: {
      id: row.id,
      barcode: row.barcode,
      status: row.status,
      priceBuy: Number(row.price_buy) > 0 ? row.price_buy : row.buying_price,
      priceSell: Number(row.price_sell) > 0 ? row.price_sell : row.selling_price,
      discount: row.discount || 0,
      checkedInAt: row.checked_in_at,
      category: row.category,
      subcategory: row.subcategory,
      imagePath: row.image_path || null,
      requiresPricingReview: !(Number(row.price_buy) > 0 || Number(row.buying_price) > 0)
        || !(Number(row.price_sell) > 0 || Number(row.selling_price) > 0),
    },
  };
});

register('checkout-sale', async (event, input = {}) => {
  const user = requireRole(event, ['sales']);
  const shift = await requireActiveShift(user);
  const method = input.paymentMethod === 'mpesa' ? 'mpesa' : input.paymentMethod;
  if (!['cash', 'mpesa'].includes(method)) {
    throw new Error('Select cash or M-Pesa as the payment method.');
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) {
    throw new Error('A sale must include between 1 and 100 scanned items.');
  }
  const identifiers = input.items.map((item) => cleanText(item?.barcode, 'Barcode', 80));
  if (new Set(identifiers).size !== identifiers.length) {
    throw new Error('The same item cannot be sold twice in one sale.');
  }
  const customerName = typeof input.customerName === 'string' ? input.customerName.trim().slice(0, 120) : '';
  const reference = method === 'mpesa' ? receiptCode(input.paymentReference || input.mpesaCode) : null;
  const result = await db.transaction(async (tx) => {
    if (reference) {
      const duplicate = await tx.get(
        `SELECT id FROM sales WHERE payment_reference = ?
         UNION ALL SELECT id FROM mpesa_payments WHERE receipt_code = ? LIMIT 1`,
        [reference, reference],
      );
      if (duplicate) throw new Error('That M-Pesa receipt code has already been used.');
    }
    const rows = await inventoryRows(tx, identifiers);
    if (rows.length !== identifiers.length) {
      throw new Error('One or more scanned items are no longer in stock. Refresh inventory before retrying.');
    }
    return createSale(tx, user, shift, rows, {
      method,
      status: method === 'mpesa' ? 'manual_confirmed' : 'paid',
      reference,
      customerName,
    });
  });
  return { success: true, ...result };
});

register('get-sale-receipt', async (event, saleId) => {
  const actor = requireRole(event, ['sales', 'admin', 'owner']);
  const id = Number(saleId);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Sale number must be a positive integer.');
  const row = await db.getAsync(
    `SELECT sales.*, users.name AS userName
     FROM sales LEFT JOIN users ON users.id = sales.user_id
     WHERE sales.id = ?`,
    [id],
  );
  if (!row) throw new Error('Receipt is not available for that sale.');
  if (actor.role === 'sales' && row.user_id !== actor.id) {
    throw new Error('You can only print receipts for your own sales.');
  }
  const sale = normalizeSale(row);
  return {
    success: true,
    receipt: {
      ...sale,
      business: sale.business?.name ? sale.business : receiptBusiness(),
    },
  };
});

register('request-mpesa-stk', async (event, input = {}) => {
  const user = requireRole(event, ['sales']);
  const shift = await requireActiveShift(user);
  darajaConfiguration();
  const phoneNumber = String(input.phoneNumber || '').replace(/[+\s-]/g, '');
  if (!/^254(?:7|1)\d{8}$/.test(phoneNumber)) {
    throw new Error('Enter a valid Kenyan mobile number, for example 2547XXXXXXXX.');
  }
  if (!Array.isArray(input.barcodes) || input.barcodes.length < 1 || input.barcodes.length > 100) {
    throw new Error('Scan at least one available item before requesting payment.');
  }
  const barcodes = input.barcodes.map((barcode) => cleanText(barcode, 'Barcode', 80));
  if (new Set(barcodes).size !== barcodes.length) throw new Error('Duplicate items cannot be charged.');

  const reservation = await db.transaction(async (tx) => {
    const rows = await inventoryRows(tx, barcodes);
    if (rows.length !== barcodes.length) throw new Error('One or more items are no longer in stock.');
    const lines = rows.map(saleSnapshot);
    const amountCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    if (amountCents <= 0 || amountCents % 100 !== 0) {
      throw new Error('Daraja STK Push currently requires a whole-shilling total.');
    }
    const now = new Date().toISOString();
    const payment = await tx.run(
      `INSERT INTO mpesa_payments
        (user_id, shift_id, phone_number, amount_cents, status, items_snapshot, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [user.id, shift.id, phoneNumber, amountCents, JSON.stringify(rows), now, now],
    );
    for (const row of rows) {
      const update = await tx.run(
        `UPDATE items SET status = 'pending_payment', pending_payment_id = ?
         WHERE id = ? AND status = 'in_stock'`,
        [payment.lastID, row.id],
      );
      if (update.changes !== 1) throw new Error(`Item ${row.barcode} is no longer available.`);
    }
    await audit(tx, user.id, shift.id, 'mpesa.stk_requested', 'mpesa_payment', payment.lastID, {
      itemCount: rows.length,
      amountCents,
      phoneSuffix: phoneNumber.slice(-3),
    });
    return { id: payment.lastID, amountCents };
  });

  let push;
  try {
    push = await sendStkPush({
      phoneNumber,
      amountCents: reservation.amountCents,
      accountReference: `GG${reservation.id}`,
    });
  } catch (error) {
    await db.transaction(async (tx) => {
      await releaseMpesaReservation(tx, reservation.id);
      await tx.run(
        `UPDATE mpesa_payments SET status = 'failed', result_description = ?, updated_at = ?
         WHERE id = ? AND status = 'pending'`,
        [String(error.message).slice(0, 255), new Date().toISOString(), reservation.id],
      );
      await audit(tx, user.id, shift.id, 'mpesa.stk_failed', 'mpesa_payment', reservation.id);
    });
    throw error;
  }

  try {
    await db.transaction(async (tx) => {
      await tx.run(
        `UPDATE mpesa_payments SET checkout_request_id = ?, merchant_request_id = ?, updated_at = ?
         WHERE id = ? AND status = 'pending'`,
        [push.checkoutRequestId, push.merchantRequestId, new Date().toISOString(), reservation.id],
      );
    });
    return {
      success: true,
      paymentId: reservation.id,
      checkoutRequestId: push.checkoutRequestId,
      message: push.responseDescription,
    };
  } catch (error) {
    console.error('Daraja accepted STK Push but its tracking update failed:', error);
    throw new Error('The payment prompt was sent, but its tracking status could not be saved. Do not request a second prompt; ask an administrator to reconcile it.');
  }
});

register('get-mpesa-payments', async (event, filters = {}) => {
  const actor = requireRole(event, ['admin', 'owner', 'sales']);
  const isManager = ['admin', 'owner'].includes(actor.role);
  const paymentFilters = isManager ? { ...filters } : {};
  const range = dateRange(paymentFilters, 'payments', false);
  let where = range.sql;
  const params = range.params;
  if (!isManager) {
    where += ' AND payments.user_id = ?';
    params.push(actor.id);
  }
  if (filters.paymentId != null) {
    const paymentId = Number(filters.paymentId);
    if (!Number.isSafeInteger(paymentId) || paymentId < 1) {
      throw new Error('Payment ID must be a positive integer.');
    }
    where += ' AND payments.id = ?';
    params.push(paymentId);
  }
  const payments = await db.allAsync(
    `SELECT payments.id, payments.phone_number, payments.amount_cents, payments.status,
            payments.receipt_code, payments.result_description, payments.created_at,
            users.name AS staff_name, sales.id AS sale_id
     FROM mpesa_payments AS payments
     JOIN users ON users.id = payments.user_id
     LEFT JOIN sales ON sales.id = payments.sale_id
     WHERE 1=1 ${where}
     ORDER BY payments.created_at DESC
     LIMIT ?`,
    [...params, isManager ? 1000 : 50],
  );
  return {
    success: true,
    payments: payments.map((payment) => ({
      ...payment,
      phone_number: `${payment.phone_number.slice(0, 5)}••••${payment.phone_number.slice(-3)}`,
      amount: fromCents(payment.amount_cents),
    })),
  };
});

register('get-all-staff', async (event) => {
  requireRole(event, ['admin', 'owner']);
  const rows = await db.allAsync(
    `SELECT users.id, users.name, users.shift,
       CASE WHEN shifts.check_out IS NULL THEN shifts.id ELSE NULL END AS activeShiftId,
       shifts.check_in AS checkIn, shifts.check_out AS checkOut,
       COALESCE((SELECT SUM(s.taxable_amount_cents) FROM sales s WHERE s.shift_id = shifts.id), 0) AS shiftSalesCents,
       COALESCE((SELECT COUNT(*) FROM sales s WHERE s.shift_id = shifts.id), 0) AS shiftSalesCount,
       COALESCE((SELECT SUM(json_array_length(s.items)) FROM sales s WHERE s.shift_id = shifts.id), 0) AS itemsSold,
       (SELECT COUNT(*) FROM shifts all_shifts WHERE all_shifts.user_id = users.id) AS totalShifts
     FROM users
     LEFT JOIN shifts ON shifts.id = (
       SELECT latest.id FROM shifts AS latest
       WHERE latest.user_id = users.id
       ORDER BY (latest.check_out IS NULL) DESC, latest.id DESC LIMIT 1
     )
     WHERE users.role = 'sales'
     ORDER BY users.name COLLATE NOCASE`,
  );
  return {
    success: true,
    staff: rows.map((row) => ({
      id: row.id,
      name: row.name,
      shift: row.shift,
      activeShiftId: row.activeShiftId || null,
      checkIn: row.checkIn || '—',
      checkOut: row.checkOut || '—',
      shiftSalesCents: row.shiftSalesCents,
      shiftRevenue: fromCents(row.shiftSalesCents),
      shiftSalesCount: row.shiftSalesCount,
      itemsSold: row.itemsSold,
      totalShifts: row.totalShifts,
      performance: row.shiftSalesCount ? fromCents(row.shiftSalesCents) : 0,
      issues: row.activeShiftId ? 'Active' : 'Off shift',
    })),
  };
});

register('add-staff', async (event, staff = {}) => {
  const actor = requireRole(event, ['admin', 'owner']);
  const name = cleanText(staff.name, 'Staff username', 80);
  if (typeof staff.password !== 'string' || staff.password.length < 10 || staff.password.length > 128) {
    throw new Error('Staff passwords must be between 10 and 128 characters.');
  }
  const roleShift = ['day', 'night'].includes(staff.shift) ? staff.shift : null;
  const result = await db.transaction(async (tx) => {
    const insert = await tx.run(
      `INSERT INTO users (name, role, password_hash, shift, must_change_password)
       VALUES (?, 'sales', ?, ?, 1)`,
      [name, bcrypt.hashSync(staff.password, 12), roleShift],
    );
    await audit(tx, actor.id, null, 'staff.created', 'user', insert.lastID, { username: name });
    return insert.lastID;
  });
  return { success: true, id: result };
});

function dateRange(filters = {}, table = 'sales', includePaymentMethod = true) {
  const clauses = [];
  const params = [];
  if (typeof filters.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(filters.startDate)) {
    clauses.push(`${table}.created_at >= ?`);
    params.push(new Date(`${filters.startDate}T00:00:00+03:00`).toISOString());
  }
  if (filters.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(filters.startDate))) {
    throw new Error('Report start date must use YYYY-MM-DD.');
  }
  if (typeof filters.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)) {
    const nextDay = new Date(`${filters.endDate}T00:00:00+03:00`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    clauses.push(`${table}.created_at < ?`);
    params.push(nextDay.toISOString());
  }
  if (filters.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(filters.endDate))) {
    throw new Error('Report end date must use YYYY-MM-DD.');
  }
  if (Number.isInteger(Number(filters.userId)) && Number(filters.userId) > 0) {
    clauses.push(`${table}.user_id = ?`);
    params.push(Number(filters.userId));
  }
  if (includePaymentMethod && typeof filters.paymentMethod === 'string' && ['cash', 'mpesa'].includes(filters.paymentMethod)) {
    clauses.push(`${table}.payment_method = ?`);
    params.push(filters.paymentMethod);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params };
}

register('get-sales', async (event, filters = {}) => {
  requireRole(event, ['admin', 'owner']);
  const range = dateRange(filters);
  const rows = await db.allAsync(
    `SELECT sales.*, users.name AS userName
     FROM sales LEFT JOIN users ON sales.user_id = users.id
     WHERE 1=1 ${range.sql}
     ORDER BY sales.created_at DESC LIMIT 5000`,
    range.params,
  );
  return { success: true, sales: rows.map(normalizeSale) };
});

register('get-dashboard', async (event) => {
  requireRole(event, ['admin', 'owner']);
  const now = new Date();
  const nairobiToday = nairobiDateKey(now);
  const todayDate = new Date(`${nairobiToday}T00:00:00+03:00`);
  const today = todayDate.toISOString();
  const weekDate = new Date(todayDate);
  weekDate.setUTCDate(weekDate.getUTCDate() - 6);
  const weekStart = weekDate.toISOString();
  const salesRows = await db.allAsync(
    `SELECT sales.*, users.name AS userName
     FROM sales LEFT JOIN users ON users.id = sales.user_id
     WHERE sales.created_at >= ? ORDER BY sales.created_at DESC`,
    [weekStart],
  );
  const sales = salesRows.map(normalizeSale);
  const todaySales = sales.filter((sale) => sale.createdAt >= today);
  const inventoryProducts = await db.allAsync(
    `SELECT categories.name AS category, subcategories.name AS subcategory,
            COUNT(items.id) AS quantity,
            COALESCE(SUM(COALESCE(items.price_buy, items.buying_price, 0)), 0) AS cost_value,
            COALESCE(SUM(COALESCE(items.price_sell, items.selling_price, 0)), 0) AS retail_value
     FROM subcategories
     LEFT JOIN categories ON categories.id = subcategories.category_id
     LEFT JOIN items ON items.subcategory_id = subcategories.id AND items.status = 'in_stock'
     GROUP BY categories.name, subcategories.name, subcategories.id`,
  );
  const daily = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(weekDate);
    day.setUTCDate(day.getUTCDate() + offset);
    const date = nairobiDateKey(day);
    const daySales = sales.filter((sale) => (
      nairobiDateKey(new Date(sale.createdAt)) === date
    ));
    return {
      date,
      revenueCents: daySales.reduce((sum, sale) => sum + sale.taxableAmountCents, 0),
      vatCents: daySales.reduce((sum, sale) => sum + sale.taxTotalCents, 0),
      collectedCents: daySales.reduce((sum, sale) => sum + sale.totalAmountCents, 0),
      grossProfitCents: daySales.reduce((sum, sale) => sum + sale.grossProfitCents, 0),
      count: daySales.length,
    };
  });
  const productMetrics = new Map();
  for (const sale of sales) {
    for (const line of sale.items) {
      const name = `${line.category || 'Uncategorized'} / ${line.subcategory || 'Uncategorized'}`;
      const current = productMetrics.get(name) || { name, quantity: 0, revenueCents: 0 };
      current.quantity += 1;
      current.revenueCents += (line.lineTotalCents || 0) - (line.vatAmountCents || 0);
      productMetrics.set(name, current);
    }
  }
  const staffRows = await db.allAsync(
    `SELECT users.id, users.name,
       COALESCE(SUM(sales.taxable_amount_cents), 0) AS revenue_cents,
       COUNT(sales.id) AS sale_count
     FROM users LEFT JOIN sales ON sales.user_id = users.id AND sales.created_at >= ?
     WHERE users.role = 'sales'
     GROUP BY users.id ORDER BY revenue_cents DESC`,
    [weekStart],
  );
  const paymentSummary = sales.reduce((result, sale) => {
    result[sale.paymentMethod] = (result[sale.paymentMethod] || 0) + sale.totalAmountCents;
    return result;
  }, {});
  const stockSummary = inventoryProducts.map((product) => ({
    name: `${product.category || 'Uncategorized'} / ${product.subcategory || 'Uncategorized'}`,
    quantity: product.quantity,
    costCents: toCents(product.cost_value, 'Inventory cost'),
    retailCents: toCents(product.retail_value, 'Inventory retail value'),
  }));
  const activeShifts = await db.getAsync(
    `SELECT COUNT(*) AS count FROM shifts WHERE check_out IS NULL`,
  );
  const legacyRecords = await db.getAsync(
    `SELECT COUNT(*) AS count FROM sales WHERE payment_status = 'legacy_unverified'`,
  );
  return {
    success: true,
    period: { startDate: weekDate.toISOString().slice(0, 10), endDate: nairobiToday },
    kpis: {
      todayRevenueCents: todaySales.reduce((sum, sale) => sum + sale.taxableAmountCents, 0),
      todayCollectedCents: todaySales.reduce((sum, sale) => sum + sale.totalAmountCents, 0),
      todayVatCents: todaySales.reduce((sum, sale) => sum + sale.taxTotalCents, 0),
      todayNetSalesCents: todaySales.reduce((sum, sale) => sum + sale.taxableAmountCents, 0),
      todaySales: todaySales.length,
      averageSaleCents: todaySales.length
        ? Math.round(todaySales.reduce((sum, sale) => sum + sale.taxableAmountCents, 0) / todaySales.length)
        : 0,
      todayGrossProfitCents: todaySales.reduce((sum, sale) => sum + sale.grossProfitCents, 0),
      weekRevenueCents: sales.reduce((sum, sale) => sum + sale.taxableAmountCents, 0),
      weekCollectedCents: sales.reduce((sum, sale) => sum + sale.totalAmountCents, 0),
      weekVatCents: sales.reduce((sum, sale) => sum + sale.taxTotalCents, 0),
      weekNetSalesCents: sales.reduce((sum, sale) => sum + sale.taxableAmountCents, 0),
      weekGrossProfitCents: sales.reduce((sum, sale) => sum + sale.grossProfitCents, 0),
      weekSales: sales.length,
      unitsInStock: stockSummary.reduce((sum, product) => sum + product.quantity, 0),
      inventoryCostCents: stockSummary.reduce((sum, row) => sum + row.costCents, 0),
      inventoryRetailCents: stockSummary.reduce((sum, row) => sum + row.retailCents, 0),
      activeStaff: activeShifts.count,
      lowStockProducts: stockSummary.filter((row) => row.quantity <= LOW_STOCK_THRESHOLD).length,
      legacyUnverifiedSales: legacyRecords.count,
    },
    daily,
    paymentSummary,
    topProducts: [...productMetrics.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8),
    staffPerformance: staffRows.map((row) => ({
      ...row,
      revenue: fromCents(row.revenue_cents),
    })),
    lowStock: stockSummary.filter((row) => row.quantity <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.quantity - b.quantity).slice(0, 12),
    recentSales: sales.slice(0, 8),
  };
});

register('get-audit-events', async (event, limit = 200) => {
  requireRole(event, ['admin', 'owner']);
  const safeLimit = Math.max(1, Math.min(500, Number.parseInt(limit, 10) || 200));
  const events = await db.allAsync(
    `SELECT audit_events.id, audit_events.event_type, audit_events.entity_type,
            audit_events.entity_id, audit_events.details, audit_events.created_at,
            users.name AS actor_name
     FROM audit_events LEFT JOIN users ON users.id = audit_events.actor_id
     ORDER BY audit_events.id DESC LIMIT ?`,
    [safeLimit],
  );
  return {
    success: true,
    events: events.map((row) => ({
      ...row,
      details: parseJsonObject(row.details),
    })),
  };
});

register('save-item-image', async (event, filename, dataUrl) => {
  const actor = requireRole(event, ['admin', 'owner']);
  const safeName = path.basename(cleanText(filename, 'Image filename', 120));
  if (!/\.(png|jpe?g|webp)$/i.test(safeName) || typeof dataUrl !== 'string' || dataUrl.length > 5_000_000) {
    throw new Error('Choose a PNG, JPEG, or WebP image smaller than 4 MB.');
  }
  const match = dataUrl.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('The selected image data is not valid.');
  const imageDirectory = path.join(app.getPath('userData'), 'item-images');
  fs.mkdirSync(imageDirectory, { recursive: true });
  const filePath = path.join(imageDirectory, `${Date.now()}-${safeName}`);
  fs.writeFileSync(filePath, Buffer.from(match[1], 'base64'), { flag: 'wx' });
  await db.transaction((tx) => audit(tx, actor.id, null, 'inventory.image_saved', 'image', safeName));
  return { success: true, path: filePath };
});

async function startApplication() {
  try {
    await db.ready;
    startCallbackServer();
    createWindow();
  } catch (error) {
    console.error('Database initialization failed:', error);
    dialog.showErrorBox('Inventory system could not start', error.message);
    app.quit();
  }
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) {
    app.quit();
    return;
  }
  startApplication();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('before-quit', () => callbackServer?.close());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
