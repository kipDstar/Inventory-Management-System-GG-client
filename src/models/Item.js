// src/models/Item.js
// Item model: represents a physical product with barcode

class Item {
  constructor({ id, subcategoryId, barcode, checkedInAt, priceBuy, priceSell, discount, status }) {
    this.id = id; // unique
    this.subcategoryId = subcategoryId;
    this.barcode = barcode; // unique, scanned
    this.checkedInAt = checkedInAt; // timestamp
    this.priceBuy = priceBuy;
    this.priceSell = priceSell;
    this.discount = discount || 0;
    this.status = status || 'in_stock'; // 'in_stock', 'sold', 'removed'
  }
}

module.exports = Item;
