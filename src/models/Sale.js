// src/models/Sale.js
// Sale model: records a sale transaction

class Sale {
  constructor({ id, userId, shift, items, paymentMethod, createdAt, categoryId, subcategoryId, special, failedBarcodes }) {
    this.id = id; // unique
    this.userId = userId; // who made the sale
    this.shift = shift; // 'day' or 'night'
    this.items = items; // array of { itemId, barcode }
    this.paymentMethod = paymentMethod; // 'cash' or 'mpesa'
    this.createdAt = createdAt; // timestamp
    this.categoryId = categoryId;
    this.subcategoryId = subcategoryId;
    this.special = special || false; // admin special deduction
    this.failedBarcodes = failedBarcodes || [];
  }
}

module.exports = Sale;
