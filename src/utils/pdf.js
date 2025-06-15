// src/utils/pdf.js
// Utility for generating PDF reports

const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable');

function generateSalesReport(sales, filename = 'sales_report.pdf', password) {
  const doc = new jsPDF();
  doc.text('GG Liquor Shop Sales Report', 10, 10);
  // Example: add table
  autoTable(doc, {
    head: [['Date', 'Salesperson', 'Category', 'Subcategory', 'Barcode', 'Qty', 'Payment', 'Amount']],
    body: sales.map(sale => [
      sale.createdAt,
      sale.userName,
      sale.categoryName,
      sale.subcategoryName,
      sale.items.map(i => i.barcode).join(', '),
      sale.items.length,
      sale.paymentMethod,
      sale.items.reduce((sum, i) => sum + (i.priceSell - (i.discount || 0)), 0)
    ])
  });
  // Password protection (if supported)
  if (password && doc.setPassword) {
    doc.setPassword(password);
  }
  doc.save(filename);
}

module.exports = { generateSalesReport };
