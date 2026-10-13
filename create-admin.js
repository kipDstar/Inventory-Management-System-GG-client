const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const username = process.env.IMS_ADMIN_USERNAME;
const password = process.env.IMS_ADMIN_PASSWORD;
if (!username || username.length > 80 || !password || password.length < 10 || password.length > 128) {
  console.error('Set IMS_ADMIN_USERNAME and an IMS_ADMIN_PASSWORD between 10 and 128 characters.');
  process.exitCode = 1;
  process.exit();
}

const dbPath = process.env.IMS_DB_PATH || path.join(__dirname, 'data', 'inventory.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);
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
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.all('PRAGMA table_info(users)', [], (schemaError, columns) => {
    if (schemaError) {
      console.error('Database schema error:', schemaError.message);
      db.close();
      return;
    }
    const hasPasswordFlag = columns.some((column) => column.name === 'must_change_password');
    const createAdmin = () => {
      db.get('SELECT id FROM users WHERE name = ?', [username], (err, row) => {
        if (err) {
          console.error('Database error:', err.message);
          db.close();
          return;
        }
        if (row) {
          console.log('That administrator account already exists.');
          db.close();
          return;
        }
        db.run(
          `INSERT INTO users (name, role, password_hash, shift, must_change_password)
           VALUES (?, 'admin', ?, 'day', 0)`,
          [username, bcrypt.hashSync(password, 12)],
          (insertError) => {
            if (insertError) console.error('Failed to create administrator:', insertError.message);
            else console.log('Administrator account created.');
            db.close();
          }
        );
      });
    };
    if (!hasPasswordFlag) {
      db.run(
        'ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0',
        (alterError) => {
          if (alterError) {
            console.error('Could not update the users table:', alterError.message);
            db.close();
          } else createAdmin();
        },
      );
    } else {
      createAdmin();
    }
  });
});