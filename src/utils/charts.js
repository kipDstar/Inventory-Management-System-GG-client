// src/utils/charts.js
// Utility for generating chart data (for admin dashboard)

function getSalesPerformanceData(sales, users) {
  // Returns data suitable for Chart.js or similar
  // Example: [{ user: 'Alice', total: 10000 }, ...]
  const userTotals = {};
  sales.forEach(sale => {
    if (!userTotals[sale.userId]) userTotals[sale.userId] = 0;
    userTotals[sale.userId] += sale.items.reduce((sum, item) => sum + (item.priceSell - item.priceBuy - (item.discount || 0)), 0);
  });
  return users.map(user => ({
    user: user.name,
    total: userTotals[user.id] || 0
  }));
}

module.exports = { getSalesPerformanceData };
