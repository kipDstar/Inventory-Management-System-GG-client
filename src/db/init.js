// src/db/init.js
// SQLite DB initialization and table creation

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/inventory.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      shift TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcategory_id INTEGER,
      barcode TEXT NOT NULL UNIQUE,
      checked_in_at TEXT,
      price_buy REAL,
      price_sell REAL,
      discount REAL,
      status TEXT,
      FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      shift TEXT,
      items TEXT,
      payment_method TEXT,
      created_at TEXT,
      category_id INTEGER,
      subcategory_id INTEGER,
      special INTEGER,
      failed_barcodes TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      check_in TEXT,
      check_out TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
  });
}

module.exports = { db, initDb };
