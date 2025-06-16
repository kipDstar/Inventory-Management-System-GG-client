const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const os = require('os');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Use the actual preload.js path
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// USER AUTH
ipcMain.handle('login', async (event, username, password) => {
  console.log('Login attempt:', username, password);
  return new Promise((resolve) => {
    db.get('SELECT * FROM users WHERE name = ?', [username], (err, user) => {
      console.log('DB user:', user);
      if (err || !user) return resolve({ success: false, error: 'User not found' });
      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) return resolve({ success: false, error: 'Invalid password' });
      const { password_hash, ...userSafe } = user;
      resolve({ success: true, user: userSafe });
    });
  });
});

// CHECK-IN (add new stock)
ipcMain.handle('check-in', async (event, item) => {
  console.log('Check-in called with:', item);
  return new Promise((resolve) => {
    if (!item.barcode || !item.category || !item.subcategory || !item.quantity || !item.priceBuy || !item.priceSell) {
      console.log('Check-in missing fields:', item);
      return resolve({ success: false, error: 'Missing required fields' });
    }
    db.get('SELECT id FROM categories WHERE name = ?', [item.category], (err, catRow) => {
      if (err) {
        console.log('Category lookup error:', err);
        return resolve({ success: false, error: 'DB error (category)' });
      }
      const insertCategory = (cb) => {
        db.run('INSERT INTO categories (name) VALUES (?)', [item.category], function (err) {
          if (err) return resolve({ success: false, error: 'DB error (insert category)' });
          cb(this.lastID);
        });
      };
      const categoryId = catRow ? catRow.id : null;
      const withCategory = (catId) => {
        db.get('SELECT id FROM subcategories WHERE name = ? AND category_id = ?', [item.subcategory, catId], (err, subRow) => {
          if (err) return resolve({ success: false, error: 'DB error (subcategory)' });
          const insertSubcategory = (cb) => {
            db.run('INSERT INTO subcategories (name, category_id) VALUES (?, ?)', [item.subcategory, catId], function (err) {
              if (err) return resolve({ success: false, error: 'DB error (insert subcategory)' });
              cb(this.lastID);
            });
          };
          const subcategoryId = subRow ? subRow.id : null;
          const withSubcategory = (subId) => {
            const now = new Date().toISOString();
            let inserted = 0, failed = 0;
            for (let i = 0; i < item.quantity; i++) {
              db.run('INSERT INTO items (subcategory_id, barcode, checked_in_at, price_buy, price_sell, discount, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [subId, item.barcode + (item.quantity > 1 ? '-' + (i+1) : ''), now, item.priceBuy, item.priceSell, item.discount || 0, 'in_stock'],
                function (err) {
                  if (err) {
                    console.log('Insert error:', err);
                  } else {
                    console.log('Inserted item with barcode:', item.barcode);
                  }
                  if (inserted + failed === item.quantity) {
                    if (inserted > 0) resolve({ success: true, inserted, failed });
                    else resolve({ success: false, error: 'All insertions failed' });
                  }
                }
              );
            }
          };
          if (subcategoryId) withSubcategory(subcategoryId);
          else insertSubcategory(withSubcategory);
        });
      };
      if (categoryId) withCategory(categoryId);
      else insertCategory(withCategory);
    });
  });
});

// FETCH ALL INVENTORY ITEMS
ipcMain.handle('get-all-items', async () => {
  return new Promise((resolve) => {
    db.all(`SELECT items.*, c.name as category, s.name as subcategory FROM items
      LEFT JOIN subcategories s ON items.subcategory_id = s.id
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE items.status = 'in_stock'`, [], (err, rows) => {
      if (err) return resolve({ success: false, error: 'DB error' });
      const items = rows.map(row => ({
        id: row.id,
        barcode: row.barcode,
        status: row.status,
        priceBuy: row.price_buy,
        priceSell: row.price_sell,
        discount: row.discount,
        checkedInAt: row.checked_in_at,
        category: row.category,
        subcategory: row.subcategory,
      }));
      resolve({ success: true, items });
    });
  });
});

// FETCH INVENTORY (alias for get-all-items)
ipcMain.handle('getInventory', async () => {
  try {
    const rows = await db.allAsync(`
      SELECT items.*, c.name as category, s.name as subcategory FROM items
      LEFT JOIN subcategories s ON items.subcategory_id = s.id
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE items.status = 'in_stock'
    `);
    return { success: true, items: rows };
  } catch (err) {
    return { success: false, items: [], error: err.message };
  }
});

// ADD INVENTORY ITEMS (for barcode batch check-in)
ipcMain.handle('addInventoryItems', async (event, { category, subcategory, buyingPrice, sellingPrice, discount, image, barcodes }) => {
  try {
    let catId, subId;
    let catRow = await new Promise((resolve) => {
      db.get('SELECT id FROM categories WHERE name = ?', [category], (err, row) => resolve(row));
    });
    if (!catRow) {
      catId = await new Promise((resolve, reject) => {
        db.run('INSERT INTO categories (name) VALUES (?)', [category], function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    } else {
      catId = catRow.id;
    }
    let subRow = await new Promise((resolve) => {
      db.get('SELECT id FROM subcategories WHERE name = ? AND category_id = ?', [subcategory, catId], (err, row) => resolve(row));
    });
    if (!subRow) {
      subId = await new Promise((resolve, reject) => {
        db.run('INSERT INTO subcategories (name, category_id) VALUES (?, ?)', [subcategory, catId], function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    } else {
      subId = subRow.id;
    }
    for (const code of barcodes) {
      await db.runAsync(
        `INSERT INTO items (subcategory_id, barcode, buying_price, selling_price, discount, image_path, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [subId, code, buyingPrice, sellingPrice, discount, image ? image.path : null, 'in_stock']
      );
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// GET ITEM BY BARCODE
ipcMain.handle('get-item-by-barcode', async (event, barcode) => {
  return new Promise((resolve) => {
    db.get(`SELECT items.*, c.name as category, s.name as subcategory, c.id as categoryId, s.id as subcategoryId FROM items
      LEFT JOIN subcategories s ON items.subcategory_id = s.id
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE items.barcode = ? AND items.status = 'in_stock'`, [barcode], (err, row) => {
      if (err || !row) return resolve({ success: false, error: 'Item not found' });
      const item = {
        id: row.id,
        barcode: row.barcode,
        status: row.status,
        priceBuy: row.price_buy,
        priceSell: row.price_sell,
        discount: row.discount,
        checkedInAt: row.checked_in_at,
        category: row.category,
        subcategory: row.subcategory,
        categoryId: row.categoryId,
        subcategoryId: row.subcategoryId,
      };
      resolve({ success: true, item });
    });
  });
});

// CHECKOUT SALE
ipcMain.handle('checkout-sale', async (event, sale) => {
  return new Promise((resolve) => {
    const placeholders = sale.items.map(() => '?').join(',');
    const barcodes = sale.items.map(i => i.barcode);
    db.run(`UPDATE items SET status = 'sold' WHERE barcode IN (${placeholders})`, barcodes, function (err) {
      if (err) return resolve({ success: false, error: 'Failed to update items' });
      db.run(`INSERT INTO sales (user_id, shift, items, payment_method, created_at, category_id, subcategory_id, special, failed_barcodes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sale.userId, sale.shift, JSON.stringify(sale.items), sale.paymentMethod, sale.createdAt, sale.categoryId, sale.subcategoryId, 0, JSON.stringify([])],
        function (err) {
          if (err) return resolve({ success: false, error: 'Failed to record sale' });
          resolve({ success: true });
        }
      );
    });
  });
});

// GET ALL STAFF
ipcMain.handle('get-all-staff', async () => {
  return new Promise((resolve) => {
    db.all(`SELECT id, name, shift FROM users WHERE role = 'sales'`, [], (err, rows) => {
      if (err) return resolve({ success: false, error: 'DB error' });
      const staff = rows.map(row => ({
        ...row,
        performance: '-',
        issues: '-',
        checkIn: '-',
        checkOut: '-',
      }));
      resolve({ success: true, staff });
    });
  });
});

// ADD STAFF
ipcMain.handle('add-staff', async (event, staff) => {
  return new Promise((resolve) => {
    if (!staff.name || !staff.password) return resolve({ success: false, error: 'Missing fields' });
    const hash = bcrypt.hashSync(staff.password, 10);
    db.run(`INSERT INTO users (name, role, password_hash, shift) VALUES (?, 'sales', ?, ?)`,
      [staff.name, hash, staff.shift],
      function (err) {
        if (err) return resolve({ success: false, error: 'Username already exists' });
        resolve({ success: true });
      }
    );
  });
});

// SHIFT CHECK-IN
ipcMain.handle('shift-check-in', async (event, userId) => {
  return new Promise((resolve) => {
    const now = new Date().toISOString();
    db.run(`INSERT INTO shifts (user_id, check_in) VALUES (?, ?)`, [userId, now], function (err) {
      if (err) return resolve({ success: false, error: 'Check-in failed' });
      resolve({ success: true });
    });
  });
});

// SHIFT CHECK-OUT
ipcMain.handle('shift-check-out', async (event, userId) => {
  return new Promise((resolve) => {
    const now = new Date().toISOString();
    db.run(`UPDATE shifts SET check_out = ? WHERE user_id = ? AND check_out IS NULL ORDER BY id DESC LIMIT 1`, [now, userId], function (err) {
      if (err || this.changes === 0) return resolve({ success: false, error: 'Check-out failed or not checked in' });
      resolve({ success: true });
    });
  });
});

// FETCH SALES FOR REPORTS
ipcMain.handle('get-sales', async (event, filters) => {
  return new Promise((resolve) => {
    let query = `SELECT sales.*, users.name as userName FROM sales LEFT JOIN users ON sales.user_id = users.id WHERE 1=1`;
    const params = [];
    if (filters) {
      if (filters.startDate) {
        query += ' AND sales.created_at >= ?';
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        query += ' AND sales.created_at <= ?';
        params.push(filters.endDate);
      }
      if (filters.userId) {
        query += ' AND sales.user_id = ?';
        params.push(filters.userId);
      }
      if (filters.paymentMethod) {
        query += ' AND sales.payment_method = ?';
        params.push(filters.paymentMethod);
      }
    }
    query += ' ORDER BY sales.created_at DESC';
    db.all(query, params, (err, rows) => {
      if (err) return resolve({ success: false, error: 'DB error' });
      const sales = rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        userName: row.userName,
        shift: row.shift,
        items: JSON.parse(row.items),
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
        categoryId: row.category_id,
        subcategoryId: row.subcategory_id,
        special: row.special,
        failedBarcodes: row.failed_barcodes ? JSON.parse(row.failed_barcodes) : [],
      }));
      resolve({ success: true, sales });
    });
  });
});

// SAVE ITEM IMAGE
ipcMain.handle('save-item-image', async (event, filename, dataUrl) => {
  return new Promise((resolve) => {
    try {
      const base64 = dataUrl.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      const filePath = path.join(__dirname, 'assets', filename);
      fs.writeFileSync(filePath, buffer);
      resolve({ success: true });
    } catch (e) {
      resolve({ success: false, error: 'Failed to save image' });
    }
  });
});
