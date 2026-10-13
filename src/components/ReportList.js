import React from 'react';

function isLegacyUnverified(sale) {
  return sale.financialDataComplete === false || String(sale.paymentStatus || '').toLowerCase() === 'legacy_unverified';
}

function amountOf(sale) {
  if (isLegacyUnverified(sale)) return null;
  if (sale.totalAmountCents != null) return Number(sale.totalAmountCents) / 100;
  if (sale.totalAmount != null) return Number(sale.totalAmount);
  if (!Array.isArray(sale.items)) return 0;
  return sale.items.reduce((sum, item) => sum + Number(item.priceSell || item.unitPrice || 0) * Number(item.quantity || 1), 0);
}

function ReportList({ reports = [], loading = false }) {
  return (
    <div className="report-list">
      {loading ? <p className="loading-state">Loading transactions…</p> : <div className="table-scroll"><table>
        <thead><tr><th>Date</th><th>Salesperson</th><th>Payment</th><th>Reference</th><th>Items</th><th>Net</th><th>VAT</th><th>Collected</th><th>Status</th></tr></thead>
        <tbody>{reports.map((sale, index) => <tr key={sale.id ?? index}>
          <td>{sale.createdAt ? new Date(sale.createdAt).toLocaleString() : '—'}</td>
          <td>{sale.userName || sale.name || '—'}</td>
          <td>{sale.paymentMethod || '—'}</td>
          <td>{sale.paymentReference || sale.mpesaReceiptNumber || '—'}</td>
          <td>{Array.isArray(sale.items) ? sale.items.length : sale.itemsSold ?? '—'}</td>
          <td>{isLegacyUnverified(sale) ? '—' : `KES ${(Number(sale.taxableAmountCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
          <td>{isLegacyUnverified(sale) ? '—' : `KES ${(Number(sale.taxTotalCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
          <td>{isLegacyUnverified(sale) ? <span className="unverified-amount">Historical amount unavailable</span> : `KES ${amountOf(sale).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
          <td><span className={`status-badge ${isLegacyUnverified(sale) ? 'status-warning' : ['paid', 'confirmed', 'manual_confirmed', 'completed'].includes(String(sale.paymentStatus || '').toLowerCase()) ? 'status-success' : ''}`}>{isLegacyUnverified(sale) ? 'Legacy · unverified' : sale.paymentStatus || (sale.paymentMethod === 'cash' ? 'Paid' : '—')}</span></td>
        </tr>)}{reports.length === 0 && <tr><td colSpan="9" className="empty-cell">No sales found for these filters.</td></tr>}</tbody>
      </table></div>}
    </div>
  );
}

export default ReportList;
