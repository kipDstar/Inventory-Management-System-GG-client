// src/models/Category.js
// Category model: e.g., Beer, Wine, Soft Drinks

class Category {
  constructor({ id, name }) {
    this.id = id; // unique
    this.name = name;
  }
}

module.exports = Category;
