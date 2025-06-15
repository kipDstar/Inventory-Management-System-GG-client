// src/pages/AdminDashboard.js
// Admin dashboard with charts and account balancing

import React, { useEffect, useState } from 'react';
import Chart from '../components/Chart';

function AdminDashboard({ user }) {
  const [sales, setSales] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const salesRes = await window.api.getSales({});
      const staffRes = await window.api.getAllStaff();
      if (salesRes.success && staffRes.success) {
        setSales(salesRes.sales);
        setStaff(staffRes.staff);
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (e) {
      setError('Error loading dashboard');
    }
    setLoading(false);
  };

  // Prepare chart data
  const salesByUser = {};
  sales.forEach(sale => {
    if (!salesByUser[sale.userName]) salesByUser[sale.userName] = 0;
    salesByUser[sale.userName] += sale.items.reduce((sum, i) => sum + (i.priceSell - (i.discount || 0)), 0);
  });
  const userChartData = {
    labels: Object.keys(salesByUser),
    datasets: [{
      label: 'Sales by Staff (KES)',
      data: Object.values(salesByUser),
      backgroundColor: '#eebbc3',
      borderColor: '#232946',
      borderWidth: 2,
    }],
  };

  // Pie chart for payment methods
  const paymentCounts = { cash: 0, mpesa: 0 };
  sales.forEach(sale => { paymentCounts[sale.paymentMethod] = (paymentCounts[sale.paymentMethod] || 0) + 1; });
  const paymentChartData = {
    labels: ['Cash', 'M-Pesa'],
    datasets: [{
      data: [paymentCounts.cash, paymentCounts.mpesa],
      backgroundColor: ['#eebbc3', '#b8c1ec'],
      borderColor: '#232946',
      borderWidth: 2,
    }],
  };

  // Animated counters for dashboard summary
  const totalSales = sales.reduce((sum, sale) => sum + sale.items.reduce((s, i) => s + (i.priceSell - (i.discount || 0)), 0), 0);
  const totalTransactions = sales.length;
  const totalStaff = staff.length;
  const topProducts = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const key = item.category + ' - ' + item.subcategory;
      if (!topProducts[key]) topProducts[key] = 0;
      topProducts[key] += 1;
    });
  });
  const topProductsArr = Object.entries(topProducts).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topProductsChartData = {
    labels: topProductsArr.map(([k]) => k),
    datasets: [{
      label: 'Top Products',
      data: topProductsArr.map(([,v]) => v),
      backgroundColor: ['#eebbc3','#b8c1ec','#ffd6e0','#d1e8e2','#f3eac2'],
      borderColor: '#232946',
      borderWidth: 2,
    }],
  };

  return (
    <div className="admin-dashboard card glass-bg">
      <div className="dashboard-summary">
        <div className="summary-card animated-card">
          <span className="summary-label">Total Sales</span>
          <span className="summary-value counter">KES {totalSales.toLocaleString()}</span>
        </div>
        <div className="summary-card animated-card">
          <span className="summary-label">Transactions</span>
          <span className="summary-value counter">{totalTransactions}</span>
        </div>
        <div className="summary-card animated-card">
          <span className="summary-label">Staff</span>
          <span className="summary-value counter">{totalStaff}</span>
        </div>
      </div>
      <h2 style={{fontSize:'2.2rem',fontWeight:700,letterSpacing:'-1px',marginBottom:'1.5rem'}}>Admin Dashboard</h2>
      <div style={{marginBottom:'1.5rem',color:'#888'}}>Welcome, {user.name} (admin)</div>
      {loading ? <div className="dashboard-loading">Loading dashboard...</div> : error ? <div className="error">{error}</div> : (
        <>
          <div className="dashboard-widgets">
            <div className="dashboard-widget animated-card glass-bg">
              <h3>Sales by Staff</h3>
              <Chart data={userChartData} type="bar" options={{responsive:true,plugins:{legend:{display:false}}}} />
            </div>
            <div className="dashboard-widget animated-card glass-bg">
              <h3>Payment Methods</h3>
              <Chart data={paymentChartData} type="pie" options={{responsive:true,plugins:{legend:{position:'bottom'}}}} />
            </div>
            <div className="dashboard-widget animated-card glass-bg">
              <h3>Top Products</h3>
              <Chart data={topProductsChartData} type="bar" options={{responsive:true,plugins:{legend:{display:false}}}} />
            </div>
            <div className="dashboard-widget animated-card glass-bg">
              <h3>Inventory Trends</h3>
              {/* TODO: Add inventory trends chart */}
              <div className="coming-soon">Coming soon</div>
            </div>
          </div>
          <div className="dashboard-section">
            <h3>Staff Performance</h3>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Shift</th>
                  <th>Sales (KES)</th>
                  <th>Issues</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Rank</th>
                </tr>
              </thead>
              <tbody>
                {staff.sort((a,b)=>(salesByUser[b.name]||0)-(salesByUser[a.name]||0)).map((s,idx) => (
                  <tr key={s.id} className={idx===0?'top-performer':''}>
                    <td>{s.name}</td>
                    <td>{s.shift}</td>
                    <td>{salesByUser[s.name] || 0}</td>
                    <td>{s.issues || '-'}</td>
                    <td>{s.checkIn || '-'}</td>
                    <td>{s.checkOut || '-'}</td>
                    <td>{idx+1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
