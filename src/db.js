const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDirectory = app.isPackaged
  ? app.getPath('userData')
  : path.join(process.cwd(), 'data');
const databasePath = process.env.IMS_DB_PATH || path.join(dataDirectory, 'inventory.db');

fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });

if (app.isPackaged && !fs.existsSync(databasePath)) {
  const previousDatabase = path.join(app.getAppPath(), 'data', 'inventory.db');
  if (fs.existsSync(previousDatabase)) {
    fs.copyFileSync(previousDatabase, databasePath);
  }
}

const db = new sqlite3.Database(databasePath);
if (process.platform !== 'win32') {
  fs.chmodSync(path.dirname(databasePath), 0o700);
  if (fs.existsSync(databasePath)) fs.chmodSync(databasePath, 0o600);
}
db.configure('busyTimeout', 5000);

function rawRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function rawGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

function rawAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

let operationQueue = Promise.resolve();
function enqueue(operation) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => {});
  return result;
}

db.runAsync = (sql, params = []) => enqueue(() => rawRun(sql, params));
db.getAsync = (sql, params = []) => enqueue(() => rawGet(sql, params));
db.allAsync = (sql, params = []) => enqueue(() => rawAll(sql, params));
db.transaction = (operation) => enqueue(async () => {
  await rawRun('BEGIN IMMEDIATE');
  try {
    const result = await operation({
      run: rawRun,
      get: rawGet,
      all: rawAll,
    });
    await rawRun('COMMIT');
    return result;
  } catch (error) {
    await rawRun('ROLLBACK');
    throw error;
  }
});

const baseSchema = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    role TEXT,
    password_hash TEXT,
    shift TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category_id INTEGER,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategory_id INTEGER,
    barcode TEXT UNIQUE,
    checked_in_at DATETIME,
    price_buy REAL,
    price_sell REAL,
    discount REAL DEFAULT 0,
    image_path TEXT,
    status TEXT DEFAULT 'in_stock',
    buying_price REAL,
    selling_price REAL,
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    shift TEXT,
    items TEXT,
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    category_id INTEGER,
    subcategory_id INTEGER,
    special INTEGER DEFAULT 0,
    failed_barcodes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    check_in TEXT,
    check_out TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    shift_id INTEGER,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(actor_id) REFERENCES users(id),
    FOREIGN KEY(shift_id) REFERENCES shifts(id)
  );
  CREATE TABLE IF NOT EXISTS mpesa_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shift_id INTEGER NOT NULL,
    phone_number TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    merchant_request_id TEXT,
    checkout_request_id TEXT UNIQUE,
    receipt_code TEXT UNIQUE,
    sale_id INTEGER,
    items_snapshot TEXT NOT NULL,
    result_description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(shift_id) REFERENCES shifts(id),
    FOREIGN KEY(sale_id) REFERENCES sales(id)
  );
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    shift_id INTEGER,
    movement_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    item_barcodes TEXT NOT NULL,
    unit_cost_cents INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY(actor_id) REFERENCES users(id),
    FOREIGN KEY(shift_id) REFERENCES shifts(id)
  );
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
  CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
  CREATE INDEX IF NOT EXISTS idx_sales_user_shift ON sales(user_id, shift);
  CREATE INDEX IF NOT EXISTS idx_shifts_user_checkin ON shifts(user_id, check_in);
  CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
  CREATE TRIGGER IF NOT EXISTS audit_events_no_update
    BEFORE UPDATE ON audit_events BEGIN
      SELECT RAISE(ABORT, 'audit events are immutable');
    END;
  CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
    BEFORE DELETE ON audit_events BEGIN
      SELECT RAISE(ABORT, 'audit events are immutable');
    END;
`;

const additiveColumns = {
  users: {
    must_change_password: 'INTEGER NOT NULL DEFAULT 0',
  },
  items: {
    received_by: 'INTEGER',
    received_shift_id: 'INTEGER',
    pending_payment_id: 'INTEGER',
    tax_rate_basis_points: 'INTEGER NOT NULL DEFAULT 1600',
  },
  sales: {
    shift_id: 'INTEGER',
    total_amount_cents: 'INTEGER NOT NULL DEFAULT 0',
    total_cost_cents: 'INTEGER NOT NULL DEFAULT 0',
    gross_profit_cents: 'INTEGER NOT NULL DEFAULT 0',
    taxable_amount_cents: 'INTEGER NOT NULL DEFAULT 0',
    tax_total_cents: 'INTEGER NOT NULL DEFAULT 0',
    tax_rate_basis_points: 'INTEGER NOT NULL DEFAULT 1600',
    customer_name: 'TEXT',
    receipt_business_snapshot: 'TEXT',
    payment_reference: 'TEXT',
    payment_status: "TEXT NOT NULL DEFAULT 'completed'",
    mpesa_checkout_id: 'TEXT',
    mpesa_receipt: 'TEXT',
  },
};

async function addMissingColumns() {
  for (const [table, columns] of Object.entries(additiveColumns)) {
    const existing = new Set((await rawAll(`PRAGMA table_info(${table})`)).map((column) => column.name));
    for (const [name, definition] of Object.entries(columns)) {
      if (!existing.has(name)) {
        await rawRun(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    }
  }
}

async function preserveLegacySales(tx) {
  const legacySales = await tx.all(
    `SELECT id, user_id, created_at FROM sales
     WHERE COALESCE(total_amount_cents, 0) = 0
       AND COALESCE(payment_status, '') != 'legacy_unverified'`,
  );
  for (const sale of legacySales) {
    const shift = await tx.get(
      `SELECT id FROM shifts WHERE user_id = ? AND check_in <= ?
         AND (check_out IS NULL OR check_out >= ?)
       ORDER BY id DESC LIMIT 1`,
      [sale.user_id, sale.created_at, sale.created_at],
    );
    await tx.run(
      `UPDATE sales
       SET shift_id = COALESCE(shift_id, ?),
           payment_status = 'legacy_unverified'
       WHERE id = ? AND COALESCE(total_amount_cents, 0) = 0
         AND COALESCE(payment_status, '') != 'legacy_unverified'`,
      [shift?.id || null, sale.id],
    );
  }
}

async function createCleanDataset() {
  const migration = await db.getAsync(
    'SELECT name FROM schema_migrations WHERE name = ?',
    ['clean-operational-dataset-v1'],
  );
  if (migration) return;

  const pending = await db.getAsync(
    `SELECT COUNT(*) AS count FROM mpesa_payments
     WHERE status IN ('pending', 'review_required')`,
  );
  if (pending.count > 0) {
    throw new Error('Database refresh paused: pending M-Pesa payments need reconciliation before inventory can be carried forward.');
  }

  const counts = {};
  for (const table of ['users', 'items', 'sales', 'shifts', 'audit_events', 'stock_movements', 'mpesa_payments']) {
    const row = await db.getAsync(`SELECT COUNT(*) AS count FROM ${table}`);
    counts[table] = row.count;
  }
  const archivePath = `${databasePath.replace(/\.db$/i, '')}.pre-clean-${Date.now()}.db`;
  const hasExistingData = Object.values(counts).some((count) => count > 0);
  if (hasExistingData) {
    const escapedArchivePath = archivePath.replace(/'/g, "''");
    await db.runAsync('PRAGMA wal_checkpoint(FULL)');
    await db.runAsync(`VACUUM INTO '${escapedArchivePath}'`);
    if (process.platform !== 'win32') fs.chmodSync(archivePath, 0o600);
  }

  await db.runAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.transaction(async (tx) => {
      await tx.run(
        `UPDATE items SET price_buy = buying_price
         WHERE (price_buy IS NULL OR price_buy <= 0) AND buying_price > 0`,
      );
      await tx.run(
        `UPDATE items SET price_sell = selling_price
         WHERE (price_sell IS NULL OR price_sell <= 0) AND selling_price > 0`,
      );
      await tx.run('DROP TRIGGER IF EXISTS audit_events_no_update');
      await tx.run('DROP TRIGGER IF EXISTS audit_events_no_delete');
      await tx.run('DROP TRIGGER IF EXISTS sales_no_update');
      await tx.run('DROP TRIGGER IF EXISTS sales_no_delete');
      await tx.run('DROP TRIGGER IF EXISTS stock_movements_no_update');
      await tx.run('DROP TRIGGER IF EXISTS stock_movements_no_delete');
      await tx.run('DELETE FROM mpesa_payments');
      await tx.run('DELETE FROM sales');
      await tx.run('DELETE FROM stock_movements');
      await tx.run('DELETE FROM audit_events');
      await tx.run('DELETE FROM shifts');
      await tx.run("DELETE FROM items WHERE COALESCE(status, '') != 'in_stock'");
      await tx.run(
        'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
        ['clean-operational-dataset-v1', new Date().toISOString()],
      );
      const remainingItems = await tx.get("SELECT COUNT(*) AS count FROM items WHERE status = 'in_stock'");
      await tx.run(
        `INSERT INTO audit_events
          (actor_id, shift_id, event_type, entity_type, entity_id, details, created_at)
         VALUES (NULL, NULL, 'system.clean_dataset_created', 'database', 'clean-operational-dataset-v1', ?, ?)`,
        [JSON.stringify({
          archivedTo: hasExistingData ? path.basename(archivePath) : null,
          preservedUsers: counts.users,
          removedHistoricalSales: counts.sales,
          preservedInStockItems: remainingItems.count,
        }), new Date().toISOString()],
      );
      await tx.run(`
        CREATE TRIGGER IF NOT EXISTS audit_events_no_update
        BEFORE UPDATE ON audit_events BEGIN
          SELECT RAISE(ABORT, 'audit events are immutable');
        END
      `);
      await tx.run(`
        CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
        BEFORE DELETE ON audit_events BEGIN
          SELECT RAISE(ABORT, 'audit events are immutable');
        END
      `);
    });
  } finally {
    await db.runAsync('PRAGMA foreign_keys = ON');
  }
}

db.ready = new Promise((resolve, reject) => {
  db.exec(baseSchema, async (schemaError) => {
    if (schemaError) {
      reject(schemaError);
      return;
    }
    try {
      await addMissingColumns();
      const admin = await rawGet(
        'SELECT id, password_hash, must_change_password FROM users WHERE name = ?',
        ['admin'],
      );
      if (admin && !admin.must_change_password && typeof admin.password_hash === 'string'
        && bcrypt.compareSync('admin123', admin.password_hash)) {
        await rawRun('UPDATE users SET must_change_password = 1 WHERE id = ?', [admin.id]);
      }
      await createCleanDataset();
      await db.transaction(async (tx) => {
        const migration = await tx.get(
          'SELECT name FROM schema_migrations WHERE name = ?',
          ['legacy-sale-integrity-v1'],
        );
        if (migration) return;
        await preserveLegacySales(tx);
        await tx.run(
          'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
          ['legacy-sale-integrity-v1', new Date().toISOString()],
        );
      });
      await rawRun(`
        UPDATE shifts
        SET check_out = (
          SELECT newer.check_in FROM shifts AS newer
          WHERE newer.user_id = shifts.user_id
            AND newer.check_out IS NULL
            AND newer.id > shifts.id
          ORDER BY newer.id DESC LIMIT 1
        )
        WHERE check_out IS NULL
          AND id NOT IN (
            SELECT MAX(id) FROM shifts
            WHERE check_out IS NULL GROUP BY user_id
          )
      `);
      await rawRun(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_shift_per_user
        ON shifts(user_id) WHERE check_out IS NULL
      `);
      await rawRun(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mpesa_receipt
        ON sales(payment_reference) WHERE payment_reference IS NOT NULL
      `);
      await rawRun(`
        CREATE TRIGGER IF NOT EXISTS sales_require_active_shift
        BEFORE INSERT ON sales
        WHEN NEW.user_id IS NULL OR NEW.shift_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM shifts
            WHERE shifts.id = NEW.shift_id
              AND shifts.user_id = NEW.user_id
              AND shifts.check_out IS NULL
          )
          OR NOT EXISTS (
            SELECT 1 FROM users WHERE users.id = NEW.user_id AND users.role = 'sales'
          )
          OR NEW.payment_method NOT IN ('cash', 'mpesa')
          OR (NEW.payment_method = 'mpesa'
              AND (COALESCE(NEW.special, 0) != 1 OR NEW.payment_reference IS NULL))
        BEGIN
          SELECT RAISE(ABORT, 'sales require an active sales shift and a valid payment record');
        END
      `);
      await rawRun(`
        CREATE TRIGGER IF NOT EXISTS sales_no_update
        BEFORE UPDATE ON sales BEGIN
          SELECT RAISE(ABORT, 'sales records are immutable');
        END
      `);
      await rawRun(`
        CREATE TRIGGER IF NOT EXISTS sales_no_delete
        BEFORE DELETE ON sales BEGIN
          SELECT RAISE(ABORT, 'sales records are immutable');
        END
      `);
      await rawRun(`
        CREATE TRIGGER IF NOT EXISTS stock_movements_no_update
        BEFORE UPDATE ON stock_movements BEGIN
          SELECT RAISE(ABORT, 'stock movements are immutable');
        END
      `);
      await rawRun(`
        CREATE TRIGGER IF NOT EXISTS stock_movements_no_delete
        BEFORE DELETE ON stock_movements BEGIN
          SELECT RAISE(ABORT, 'stock movements are immutable');
        END
      `);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
});

module.exports = db;
