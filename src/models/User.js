// src/models/User.js
// User model: admin or sales

class User {
  constructor({ id, name, role, passwordHash, shift }) {
    this.id = id; // unique
    this.name = name;
    this.role = role; // 'admin' or 'sales'
    this.passwordHash = passwordHash;
    this.shift = shift; // 'day' or 'night'
  }
}

module.exports = User;
