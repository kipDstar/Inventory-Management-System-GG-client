import React, { useCallback, useEffect, useState } from 'react';
import ReportList from '../components/ReportList';

function listFrom(result, key) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.[key])) return result[key];
  if (Array.isArray(result?.rows)) return result.rows;
  if (result?.success === false) throw new Error(result.error || 'Request failed.');
  return [];
}

function isLegacyUnverified(sale) {
  return sale.financialDataComplete === false || String(sale.paymentStatus || '').toLowerCase() === 'legacy_unverified';
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportSalesCsv(sales) {
  const headers = ['Sale ID', 'Date', 'Staff', 'Payment method', 'Payment reference', 'Item count', 'Items', 'Net taxable sales (KES)', 'VAT included (KES)', 'Amount collected (KES)', 'Amount status', 'Payment status'];
  const rows = sales.map(sale => {
    const legacy = isLegacyUnverified(sale);
    const items = Array.isArray(sale.items) ? sale.items.map(item => {
      const name = item.name || item.productName || item.barcode || 'Item';
      return (item.quantity || 1) + ' x ' + name;
    }).join('; ') : '';
    const amount = legacy ? '' : sale.totalAmountCents != null
      ? (Number(sale.totalAmountCents) / 100).toFixed(2)
      : sale.totalAmount != null ? Number(sale.totalAmount).toFixed(2) : '';
    const netSales = legacy ? '' : (Number(sale.taxableAmountCents || 0) / 100).toFixed(2);
    const vat = legacy ? '' : (Number(sale.taxTotalCents || 0) / 100).toFixed(2);
    return [
      sale.id,
      sale.createdAt || sale.created_at,
      sale.userName || sale.name,
      sale.paymentMethod,
      sale.paymentReference || sale.mpesaReceiptNumber,
      Array.isArray(sale.items) ? sale.items.length : sale.itemsSold,
      items,
      netSales,
      vat,
      amount,
      legacy ? 'Historical amount unavailable; unverified' : 'Verifiable',
      sale.paymentStatus || (sale.paymentMethod === 'cash' ? 'paid' : ''),
    ].map(csvCell).join(',');
  });
  const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sales-report-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReportsPage() {
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', userId: '', paymentMethod: '', paymentStatus: '' });
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [view, setView] = useState('sales');

  const fetchSales = useCallback(async (filterValues = filters) => {
    setLoading(true);
    setError('');
    try {
      const result = await window.api.getSales(filterValues);
      setSales(listFrom(result, 'sales'));
    } catch (fetchError) {
      console.error('Sales report load failed:', fetchError);
      setError(fetchError.message || 'Sales report could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchPayments = useCallback(async (filterValues = filters) => {
    setPaymentLoading(true);
    setPaymentError('');
    try {
      if (typeof window.api.getMpesaPayments !== 'function') throw new Error('M-Pesa payment audit is not available in this desktop build.');
      const result = await window.api.getMpesaPayments(filterValues);
      setPayments(listFrom(result, 'payments'));
    } catch (fetchError) {
      console.error('M-Pesa payment audit load failed:', fetchError);
      setPaymentError(fetchError.message || 'M-Pesa payment audit could not be loaded.');
    } finally {
      setPaymentLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSales({ startDate: '', endDate: '', userId: '', paymentMethod: '', paymentStatus: '' });
    fetchPayments({ startDate: '', endDate: '', userId: '', paymentMethod: '', paymentStatus: '' });
  }, []);

  const changeFilter = event => setFilters(current => ({ ...current, [event.target.name]: event.target.value }));
  const applyFilters = event => {
    event.preventDefault();
    fetchSales(filters);
    fetchPayments(filters);
  };
  const visibleSales = filters.paymentStatus ? sales.filter(sale => String(sale.paymentStatus || '').toLowerCase() === filters.paymentStatus) : sales;
  const visiblePayments = filters.paymentStatus ? payments.filter(payment => String(payment.status || payment.paymentStatus || '').toLowerCase() === filters.paymentStatus) : payments;
  const legacySalesCount = visibleSales.filter(sale => sale.financialDataComplete === false || String(sale.paymentStatus || '').toLowerCase() === 'legacy_unverified').length;
  const verifiedSales = visibleSales.filter(sale => sale.financialDataComplete !== false && String(sale.paymentStatus || '').toLowerCase() !== 'legacy_unverified');
  const total = verifiedSales.reduce((sum, sale) => sum + (sale.totalAmountCents != null ? Number(sale.totalAmountCents) / 100 : Number(sale.totalAmount || 0)), 0);
  const netSales = verifiedSales.reduce((sum, sale) => sum + Number(sale.taxableAmountCents || 0) / 100, 0);
  const vatTotal = verifiedSales.reduce((sum, sale) => sum + Number(sale.taxTotalCents || 0) / 100, 0);

  return (
    <section className="reports-page card page-card">
      <header className="page-heading"><div><p className="eyebrow">Transactions and reconciliation</p><h1>Sales reports</h1><p className="muted">Filter recorded sales and review M-Pesa payment references/status.</p></div></header>
      <form className="filters" onSubmit={applyFilters}>
        <label>Start date<input type="date" name="startDate" value={filters.startDate} onChange={changeFilter} /></label>
        <label>End date<input type="date" name="endDate" value={filters.endDate} onChange={changeFilter} /></label>
        <label>Staff user ID<input type="text" name="userId" value={filters.userId} onChange={changeFilter} placeholder="Optional" /></label>
        <label>Payment method<select name="paymentMethod" value={filters.paymentMethod} onChange={changeFilter}><option value="">All</option><option value="cash">Cash</option><option value="mpesa">M-Pesa</option></select></label>
        <label>Payment status<select name="paymentStatus" value={filters.paymentStatus} onChange={changeFilter}><option value="">All statuses</option><option value="paid">Paid (cash)</option><option value="confirmed">Confirmed</option><option value="manual_confirmed">Manual M-Pesa</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="legacy_unverified">Legacy · unverified</option></select></label>
        <button type="submit" className="primary-button" disabled={loading || paymentLoading}>Apply filters</button>
      </form>
      <div className="report-export-row">
        <button type="button" className="secondary-button" onClick={() => exportSalesCsv(visibleSales)} disabled={loading || visibleSales.length === 0}>Download sales CSV</button>
        <span className="muted">Exports the sales rows currently loaded for these filters; legacy amounts are blank and explicitly marked unverified. Daraja STK records remain in the separate ledger.</span>
      </div>
      <div className="report-summary">
        <span>{visibleSales.length.toLocaleString()} transactions · {verifiedSales.length.toLocaleString()} with verifiable totals</span>
        <div className="report-tax-totals">
          <span>Net taxable sales: KES {netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span>VAT included: KES {vatTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <strong>Collected incl. VAT: KES {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
      </div>
      {legacySalesCount > 0 && <div className="historical-data-caveat" role="note"><strong>Historical data is incomplete.</strong><span>{legacySalesCount.toLocaleString()} sale records lack immutable price snapshots. Their amounts are unknown, excluded from the verified total, and must not be interpreted as zero-value sales.</span></div>}
      <div className="tabs" role="tablist" aria-label="Report views">
        <button type="button" role="tab" aria-selected={view === 'sales'} className={view === 'sales' ? 'active' : ''} onClick={() => setView('sales')}>Sales transactions</button>
        <button type="button" role="tab" aria-selected={view === 'mpesa'} className={view === 'mpesa' ? 'active' : ''} onClick={() => setView('mpesa')}>Daraja STK ledger ({visiblePayments.length})</button>
      </div>
      {view === 'sales' ? <>
        <p className="muted report-method-note">Manual M-Pesa receipts are recorded as sales and appear in this transactions list when payment method is M-Pesa. The Daraja STK ledger below contains prompt and callback reconciliation records.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <ReportList reports={visibleSales} loading={loading} />
      </> : <section className="mpesa-audit">
        <p className="muted report-method-note">This ledger is separate from manual M-Pesa sales and tracks Daraja STK prompts and callback reconciliation.</p>
        {paymentError && <div className="error" role="alert">{paymentError}</div>}
        {paymentLoading ? <p className="loading-state">Loading M-Pesa payment records…</p> : <div className="table-scroll"><table>
          <thead><tr><th>Time</th><th>Receipt / reference</th><th>Phone</th><th>Amount</th><th>Status</th><th>Sale ID</th></tr></thead>
          <tbody>{visiblePayments.map((payment, index) => <tr key={payment.id ?? payment.paymentReference ?? index}>
            <td>{payment.createdAt || payment.created_at ? new Date(payment.createdAt || payment.created_at).toLocaleString() : '—'}</td>
            <td>{payment.receiptNumber || payment.mpesaReceiptNumber || payment.receipt_code || payment.paymentReference || payment.reference || payment.checkoutRequestID || payment.checkout_request_id || '—'}</td>
            <td>{payment.phoneNumber || payment.phone_number || payment.phone || '—'}</td>
            <td>KES {Number(payment.amount ?? (payment.amountCents != null ? payment.amountCents / 100 : 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td><span className={`status-badge ${['paid', 'confirmed', 'manual_confirmed', 'completed'].includes(String(payment.status || payment.paymentStatus).toLowerCase()) ? 'status-success' : ''}`}>{payment.status || payment.paymentStatus || 'Unknown'}</span></td>
            <td>{payment.saleId || payment.sale_id || '—'}</td>
          </tr>)}{!visiblePayments.length && <tr><td colSpan="6" className="empty-cell">No M-Pesa payment records match these filters.</td></tr>}</tbody>
        </table></div>}
      </section>}
    </section>
  );
}

export default ReportsPage;
