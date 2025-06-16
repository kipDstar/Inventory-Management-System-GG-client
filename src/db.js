const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Always use the project root /data directory for the database
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'inventory.db');
console.log('DB PATH (db.js):', dbPath);
const db = new sqlite3.Database(dbPath);

// Promisified helpers
db.allAsync = (sql, params=[]) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
db.runAsync = (sql, params=[]) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

// Create tables if they don't exist
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      role TEXT,
      password_hash TEXT,
      shift TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )
  `);

  // Subcategories table
  db.run(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category_id INTEGER,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )
  `);

  // Items table (inventory)
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcategory_id INTEGER,
      barcode TEXT UNIQUE,
      checked_in_at DATETIME,
      price_buy REAL,
      price_sell REAL,
      discount REAL,
      image_path TEXT,
      status TEXT,
      buying_price REAL,
      selling_price REAL,
      FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
    )
  `);

  // Sales table
  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      shift TEXT,
      items TEXT, -- JSON string of sold items/barcodes
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      category_id INTEGER,
      subcategory_id INTEGER,
      special INTEGER,
      failed_barcodes TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Shifts table
  db.run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      check_in DATETIME,
      check_out DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

module.exports = db;