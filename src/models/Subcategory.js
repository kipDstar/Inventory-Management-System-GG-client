// src/models/Subcategory.js
// Subcategory model: e.g., Heineken under Beer

class Subcategory {
  constructor({ id, categoryId, name }) {
    this.id = id; // unique
    this.categoryId = categoryId; // parent category
    this.name = name;
  }
}

module.exports = Subcategory;
