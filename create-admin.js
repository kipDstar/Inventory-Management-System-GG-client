const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'inventory.db');
const db = new sqlite3.Database(dbPath);

const username = 'admin'; // change if needed
const password = 'admin123'; // change if needed
const hash = bcrypt.hashSync(password, 10);

console.log('DB PATH (create-admin.js):', dbPath);

db.serialize(() => {
  // Create users table if it doesn't exist
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

  // Check if admin already exists
  db.get('SELECT * FROM users WHERE name = ?', [username], (err, row) => {
    if (err) {
      console.error('DB error:', err.message);
      db.close();
      return;
    }
    if (row) {
      console.log('Admin user already exists.');
      db.close();
      return;
    }
    // Insert admin user
    db.run(
      `INSERT INTO users (name, role, password_hash, shift) VALUES (?, 'admin', ?, ?)`,
      [username, hash, 'day'],
      function (err) {
        if (err) {
          console.error('Failed to create admin:', err.message);
        } else {
          console.log('Admin user created!');
        }
        db.close();
      }
    );
  });
});