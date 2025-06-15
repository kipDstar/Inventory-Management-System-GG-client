// src/db/auth.js
// Authentication helper for user login

const db = require('./index');
const bcrypt = require('bcryptjs');

function findUserByName(name, callback) {
  db.get('SELECT * FROM users WHERE name = ?', [name], (err, row) => {
    if (err) return callback(err);
    callback(null, row);
  });
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

module.exports = { findUserByName, verifyPassword };
