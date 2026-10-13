import React, { useCallback, useEffect, useState } from 'react';
import Chart from '../components/Chart';

const rowsOf = value => Array.isArray(value) ? value : Array.isArray(value?.rows) ? value.rows : Array.isArray(value?.data) ? value.data : [];
const amountOf = row => {
  const cents = row?.totalAmountCents ?? row?.amountCents ?? row?.revenueCents ?? row?.shiftSalesCents;
  if (cents != null) return Number(cents) / 100;
  return Number(row?.totalAmount ?? row?.amount ?? row?.revenue ?? row?.salesAmount ?? 0);
};
const countOf = row => Number(row?.count ?? row?.quantity ?? row?.itemsSold ?? row?.salesCount ?? row?.transactions ?? 0);
const formatMoney = value => `KES ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function summaryCards(kpis) {
  if (Array.isArray(kpis)) return kpis.map((item, index) => [item.label || item.name || `Metric ${index + 1}`, item.value ?? item.amount ?? 0]);
  return Object.entries(kpis || {});
}

function paymentRows(summary) {
  if (Array.isArray(summary)) return summary;
  if (summary && typeof summary === 'object') return Object.entries(summary).map(([method, details]) => ({ method, ...(typeof details === 'object' ? details : { amountCents: details }) }));
  return [];
}

function AdminDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.api.getDashboard();
      if (!result?.success) throw new Error(result?.error || 'Dashboard data could not be loaded.');
      setData(result);
    } catch (fetchError) {
      console.error('Dashboard load failed:', fetchError);
      setError(fetchError.message || 'Dashboard data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const daily = rowsOf(data?.daily);
  const payments = paymentRows(data?.paymentSummary);
  const products = rowsOf(data?.topProducts);
  const staff = rowsOf(data?.staffPerformance);
  const lowStock = rowsOf(data?.lowStock);
  const recentSales = rowsOf(data?.recentSales);
  const kpis = summaryCards(data?.kpis);
  const legacyUnverifiedSales = Number(data?.kpis?.legacyUnverifiedSales || 0);
  const dailyChart = {
    labels: daily.map((row, index) => row.date || row.day || row.label || `Day ${index + 1}`),
    datasets: [{ label: 'Sales (KES)', data: daily.map(amountOf), backgroundColor: '#8fb9a8', borderRadius: 5 }],
  };
  const paymentChart = {
    labels: payments.map(row => row.method || row.paymentMethod || row.label || 'Other'),
    datasets: [{ label: 'Payment value (KES)', data: payments.map(amountOf), backgroundColor: ['#8fb9a8', '#94a3d2', '#efbdc6', '#edc77c'] }],
  };
  const productChart = {
    labels: products.slice(0, 7).map(row => row.productName || row.name || row.subcategory || row.product || 'Product'),
    datasets: [{ label: 'Items sold', data: products.slice(0, 7).map(countOf), backgroundColor: '#94a3d2', borderRadius: 5 }],
  };
  const salesByStaffChart = {
    labels: staff.map(row => row.name || row.userName || `Staff ${row.id}`),
    datasets: [{ label: '7-day revenue (KES)', data: staff.map(amountOf), backgroundColor: '#efbdc6', borderRadius: 5 }],
  };

  return (
    <section className="admin-dashboard card page-card">
      <header className="page-heading">
        <div><p className="eyebrow">Overview</p><h1>Dashboard</h1><p className="muted">Welcome, {user.name}. Revenue and gross profit exclude VAT; collected totals include VAT.</p></div>
        <button type="button" className="secondary-button" onClick={fetchData} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </header>
      {error && <div className="error" role="alert">{error}</div>}
      {loading && !data ? <p className="loading-state">Loading dashboard…</p> : data && <>
        {legacyUnverifiedSales > 0 && <div className="historical-data-caveat" role="note"><strong>Historical sales need reconciliation.</strong><span>{legacyUnverifiedSales.toLocaleString()} historic sale records lack immutable price snapshots. Their amounts are unknown and excluded from verified revenue; they are not zero-value confirmed sales.</span></div>}
        <div className="dashboard-summary">
          {kpis.map(([key, value]) => {
            const label = String(key).replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, char => char.toUpperCase());
            const rawValue = value?.value ?? value?.amount ?? value;
            const numeric = /cents$/i.test(String(key)) ? Number(rawValue) / 100 : Number(rawValue);
            const isMoney = /cents$/i.test(String(key)) || /amount|revenue|profit|cost|retail|kes/i.test(String(key));
            return <div className="summary-card" key={key}><span className="summary-label">{label}</span><strong className="summary-value">{Number.isFinite(numeric) ? (isMoney ? formatMoney(numeric) : numeric.toLocaleString()) : String(value)}</strong></div>;
          })}
        </div>
        <div className="dashboard-widgets">
          <article className="dashboard-widget"><h2>Daily sales</h2>{daily.length ? <Chart data={dailyChart} options={{ responsive: true, plugins: { legend: { display: false } } }} /> : <p className="empty-state">No daily sales data.</p>}</article>
          <article className="dashboard-widget"><h2>Payment methods</h2>{payments.length ? <Chart data={paymentChart} type="pie" options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} /> : <p className="empty-state">No payment data.</p>}</article>
          <article className="dashboard-widget"><h2>Top products</h2>{products.length ? <Chart data={productChart} options={{ responsive: true, plugins: { legend: { display: false } } }} /> : <p className="empty-state">No product sales data.</p>}</article>
          <article className="dashboard-widget"><h2>Staff sales · 7 days</h2>{staff.length ? <Chart data={salesByStaffChart} options={{ responsive: true, plugins: { legend: { display: false } } }} /> : <p className="empty-state">No staff sales data.</p>}</article>
        </div>
        <div className="dashboard-columns">
          <section className="panel"><h2>Staff performance · 7 days</h2><div className="table-scroll"><table>
            <thead><tr><th>Staff</th><th>Revenue</th><th>Sales</th><th>Items sold</th></tr></thead>
            <tbody>{staff.map((row, index) => <tr key={row.id ?? row.userId ?? row.name ?? index}>
              <td>{row.name || row.userName || '—'}</td><td>{formatMoney(row.revenue ?? amountOf(row))}</td>
              <td>{row.shiftSalesCount ?? row.sale_count ?? 0}</td><td>{row.itemsSold ?? '—'}</td>
            </tr>)}{!staff.length && <tr><td colSpan="4" className="empty-cell">No staff performance data.</td></tr>}</tbody>
          </table></div></section>
          <section className="panel"><h2>Low stock</h2><div className="table-scroll"><table>
            <thead><tr><th>Product</th><th>Barcode</th><th>Available</th></tr></thead>
            <tbody>{lowStock.map((row, index) => <tr key={row.id ?? row.barcode ?? index}><td>{row.name || [row.category, row.subcategory].filter(Boolean).join(' ') || '—'}</td><td>{row.barcode || '—'}</td><td>{row.stock ?? row.quantity ?? row.available ?? 0}</td></tr>)}{!lowStock.length && <tr><td colSpan="3" className="empty-cell">No low-stock alerts.</td></tr>}</tbody>
          </table></div></section>
        </div>
        <section className="panel recent-sales"><h2>Recent sales</h2><div className="table-scroll"><table>
          <thead><tr><th>Date</th><th>Staff</th><th>Payment</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>{recentSales.map((row, index) => <tr key={row.id ?? index}><td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td><td>{row.userName || row.name || '—'}</td><td>{row.paymentMethod || '—'}</td><td>{Array.isArray(row.items) ? row.items.length : row.itemsSold ?? '—'}</td><td>{row.financialDataComplete === false || row.paymentStatus === 'legacy_unverified' ? <span className="unverified-amount">Historical amount unavailable</span> : formatMoney(amountOf(row))}</td><td><span className={`status-badge ${row.financialDataComplete === false || row.paymentStatus === 'legacy_unverified' ? 'status-warning' : ''}`}>{row.paymentStatus === 'legacy_unverified' ? 'Legacy · unverified' : row.paymentStatus || '—'}</span></td></tr>)}{!recentSales.length && <tr><td colSpan="6" className="empty-cell">No recent sales.</td></tr>}</tbody>
        </table></div></section>
      </>}
    </section>
  );
}

export default AdminDashboard;
