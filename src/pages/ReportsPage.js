// src/pages/ReportsPage.js
// Reports page for admin

import React, { useState, useEffect } from 'react';
import ReportList from '../components/ReportList';

function ReportsPage({ user }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', userId: '', paymentMethod: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.api.getSales(filters);
      if (result.success) setSales(result.sales);
      else setError(result.error || 'Failed to fetch sales');
    } catch (e) {
      setError('Error fetching sales');
    }
    setLoading(false);
  };

  const handleFilterChange = e => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleFilterSubmit = e => {
    e.preventDefault();
    fetchSales();
  };

  // Download and email handlers
  const handleDownload = async (salesToExport, password) => {
    if (!salesToExport || salesToExport.length === 0) return { success: false, error: 'No sales selected' };
    return await window.api.generateSalesReportPDF(salesToExport, password);
  };
  const handleSendEmail = async (salesToExport, email, password) => {
    if (!salesToExport || salesToExport.length === 0 || !email) return { success: false, error: 'No sales or email' };
    return await window.api.emailSalesReport(salesToExport, email, password);
  };

  return (
    <div className="reports-page card">
      <h2>Sales Reports</h2>
      <form className="filters" onSubmit={handleFilterSubmit} style={{display:'flex',gap:'1rem',marginBottom:'1rem'}}>
        <label>Start Date: <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} /></label>
        <label>End Date: <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} /></label>
        <label>User ID: <input type="text" name="userId" value={filters.userId} onChange={handleFilterChange} placeholder="(optional)" /></label>
        <label>Payment: <select name="paymentMethod" value={filters.paymentMethod} onChange={handleFilterChange}><option value="">All</option><option value="cash">Cash</option><option value="mpesa">M-Pesa</option></select></label>
        <button type="submit" disabled={loading}>Filter</button>
      </form>
      {error && <div className="error">{error}</div>}
      <ReportList reports={sales} onDownload={handleDownload} onSendEmail={handleSendEmail} loading={loading} />
    </div>
  );
}

export default ReportsPage;
