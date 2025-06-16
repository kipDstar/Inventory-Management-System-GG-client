import React, { useEffect, useState } from 'react';

// --- DashboardChart Component ---
// This component is now defined within the same file as AdminDashboard
// to resolve the import errors in this single-file environment.
function DashboardChart({ data, type, options }) {
  // Access global Chart.js and react-chartjs-2 components loaded via CDN
  const ChartJS = window.Chart;
  const { Bar, Pie } = window.ReactChartjs2 || {}; // Handle case where ReactChartjs2 might not be loaded yet

  // Register necessary Chart.js components only once
  useEffect(() => {
    if (ChartJS && !ChartJS.isRegistered) { // Use a custom flag to prevent re-registration in dev mode
        ChartJS.register(
            ChartJS.CategoryScale,
            ChartJS.LinearScale,
            ChartJS.BarElement,
            ChartJS.ArcElement,
            ChartJS.Tooltip,
            ChartJS.Legend
        );
        ChartJS.isRegistered = true; // Set flag after registration
    }
  }, [ChartJS]); // Depend on ChartJS to ensure it's available

  if (!Bar || !Pie) {
    return (
      <div className="chart-placeholder">
        <h4>Chart Library Not Loaded</h4>
        <p>Ensure Chart.js and React-Chartjs-2 CDNs are correctly linked in your HTML, or install them via npm if running locally.</p>
        <div style={{height: '150px', width: '100%', backgroundColor: '#f9e7e7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#cc0000'}}>
          Chart placeholder
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      {type === 'bar' && <Bar data={data} options={options} />}
      {type === 'pie' && <Pie data={data} options={options} />}
    </div>
  );
}

// --- SummaryCard Component ---
// This component is now defined within the same file as AdminDashboard
// to resolve the import errors in this single-file environment.
function SummaryCard({ label, value, animationDelay }) {
  return (
    <div className="summary-card animated-card" style={{ animationDelay }}>
      <span className="summary-label">{label}</span>
      <span className="summary-value counter">{value}</span>
    </div>
  );
}


// --- AdminDashboard Component ---
function AdminDashboard({ user }) {
  const [sales, setSales] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Assuming window.api calls are correctly implemented in your Electron preload or similar bridge
      // In a typical project, you might abstract these into a separate service file (e.g., src/api/dashboardApi.js)
      const salesRes = await window.api.getSales({});
      const staffRes = await window.api.getAllStaff();

      if (salesRes.success && staffRes.success) {
        setSales(salesRes.sales);
        setStaff(staffRes.staff);
      } else {
        setError('Failed to load dashboard data');
        console.error("API Response Error:", salesRes.error || staffRes.error);
      }
    } catch (e) {
      setError('Error loading dashboard: ' + e.message);
      console.error("Fetch Data Error:", e);
    }
    setLoading(false);
  };

  // --- Data Preparation for Charts & Calculations ---

  // Sales by Staff (for Bar Chart)
  const salesByUser = {};
  sales.forEach(sale => {
    // Ensure priceSell and discount are treated as numbers
    const saleAmount = sale.items.reduce((sum, i) => {
      const itemPrice = parseFloat(i.priceSell) || 0;
      const itemDiscount = parseFloat(i.discount) || 0;
      return sum + (itemPrice - itemDiscount);
    }, 0);
    if (!salesByUser[sale.userName]) salesByUser[sale.userName] = 0;
    salesByUser[sale.userName] += saleAmount;
  });

  const userChartData = {
    labels: Object.keys(salesByUser),
    datasets: [{
      label: 'Sales by Staff (KES)',
      data: Object.values(salesByUser),
      backgroundColor: '#957DAD', // Plum color
      borderColor: '#6C4D81', // Darker plum
      borderWidth: 2,
      borderRadius: 8, // Rounded bars
    }],
  };

  // Payment Methods (for Pie Chart)
  const paymentCounts = { cash: 0, mpesa: 0 };
  sales.forEach(sale => {
    // Ensure paymentMethod is valid before accessing
    if (sale.paymentMethod) {
        paymentCounts[sale.paymentMethod.toLowerCase()] = (paymentCounts[sale.paymentMethod.toLowerCase()] || 0) + 1;
    }
  });

  const paymentChartData = {
    labels: ['Cash', 'M-Pesa'],
    datasets: [{
      data: [paymentCounts.cash, paymentCounts.mpesa],
      backgroundColor: ['#A7D9D3', '#C7B1D3'], // Aqua and Lilac
      borderColor: '#232946',
      borderWidth: 2,
    }],
  };

  // Top Products (for Bar Chart)
  const topProducts = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      // Gracefully handle missing category/subcategory
      const category = item.category || 'Unknown Category';
      const subcategory = item.subcategory || 'Unknown Subcategory';
      const key = `${category} - ${subcategory}`;
      if (!topProducts[key]) topProducts[key] = 0;
      topProducts[key] += 1; // Count by number of times sold
    });
  });

  const topProductsArr = Object.entries(topProducts)
    .sort((a,b) => b[1]-a[1]) // Sort by quantity sold, descending
    .slice(0,5); // Get top 5 products

  const topProductsChartData = {
    labels: topProductsArr.map(([k]) => k),
    datasets: [{
      label: 'Units Sold',
      data: topProductsArr.map(([,v]) => v),
      backgroundColor: ['#F7B801', '#E07A5F', '#3D405B', '#81B29A', '#F2CC85'], // Earthy tones
      borderColor: '#232946',
      borderWidth: 2,
      borderRadius: 8,
    }],
  };

  // Dashboard Summary Counters
  const totalSales = sales.reduce((sum, sale) => sum + sale.items.reduce((s, i) => {
    const itemPrice = parseFloat(i.priceSell) || 0;
    const itemDiscount = parseFloat(i.discount) || 0;
    return s + (itemPrice - itemDiscount);
  }, 0), 0);
  const totalTransactions = sales.length;
  const totalStaff = staff.length;


  return (
    <div className="admin-dashboard card glass-bg">
      {/* Internal CSS for the dashboard. In a real project, this would be in src/styles/AdminDashboard.css */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes bounceIn {
          0%, 20%, 40%, 60%, 80%, 100% {
            transition-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
          }
          0% { opacity: 0; transform: scale3d(.3, .3, .3); }
          20% { transform: scale3d(1.1, 1.1, 1.1); }
          40% { transform: scale3d(.9, .9, .9); }
          60% { opacity: 1; transform: scale3d(1.03, 1.03, 1.03); }
          80% { transform: scale3d(.97, .97, .97); }
          100% { opacity: 1; transform: scale3d(1, 1, 1); }
        }

        .admin-dashboard {
          padding: 2.5rem;
          min-height: calc(100vh - 64px);
          background: #f0f4f8; /* Light background */
          animation: fadeIn 0.8s ease-out;
        }

        .card {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .glass-bg {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
        }

        h2 {
          font-size: 2.5rem;
          font-weight: 800;
          color: #232946; /* Dark Blue */
          margin-bottom: 1.5rem;
          text-align: center;
          letter-spacing: -0.5px;
        }

        .admin-dashboard > div:nth-child(3) { /* Welcome message div, targeting specifically for padding */
          font-size: 1.1rem;
          color: #666;
          margin-bottom: 2.5rem;
          text-align: center;
        }

        .dashboard-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .summary-card {
          background: linear-gradient(135deg, #A7D9D3, #81B29A); /* Greenish gradient */
          color: #fff;
          padding: 1.8rem;
          border-radius: 12px;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .summary-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
        }

        .summary-label {
          font-size: 1.1rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          opacity: 0.9;
        }

        .summary-value {
          font-size: 2.8rem;
          font-weight: 700;
          letter-spacing: -1px;
          line-height: 1.2;
        }

        /* Animated Card effect */
        .animated-card {
          animation: bounceIn 0.8s ease-out forwards;
        }
        .summary-card:nth-child(1) { animation-delay: 0.1s; }
        .summary-card:nth-child(2) { animation-delay: 0.2s; }
        .summary-card:nth-child(3) { animation-delay: 0.3s; }

        .dashboard-loading {
          text-align: center;
          padding: 3rem;
          font-size: 1.2rem;
          color: #555;
          animation: fadeIn 0.6s ease-in-out infinite alternate;
        }

        .error {
          color: #e74c3c;
          background-color: #fce4e4;
          border: 1px solid #e74c3c;
          padding: 1rem;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 2rem;
        }

        .dashboard-widgets {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .dashboard-widget {
          padding: 1.8rem;
          min-height: 350px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .dashboard-widget h3 {
          font-size: 1.6rem;
          font-weight: 700;
          color: #232946;
          margin-bottom: 1.2rem;
          border-bottom: 2px solid #ddd;
          padding-bottom: 0.8rem;
        }

        .chart-container {
            height: 250px; /* Fixed height for consistent chart size */
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative; /* For responsiveness within container */
        }
        .chart-container canvas {
            max-width: 100% !important;
            max-height: 100% !important;
        }


        .coming-soon {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-size: 1.5rem;
          font-weight: 600;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 2px;
          background: linear-gradient(45deg, #eceff1, #cfd8dc);
          border-radius: 12px;
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.05);
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.02); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
        }


        .dashboard-section h3 {
          font-size: 2rem;
          font-weight: 700;
          color: #232946;
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e0e0e0;
        }

        .dashboard-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .dashboard-table th, .dashboard-table td {
          padding: 1rem 1.2rem;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .dashboard-table th {
          background-color: #eef2f7; /* Light blue header */
          color: #333;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.9rem;
        }

        .dashboard-table tbody tr:last-child td {
          border-bottom: none;
        }

        .dashboard-table tbody tr:nth-child(even) {
          background-color: #f9f9f9;
        }

        .dashboard-table tbody tr:hover {
          background-color: #e5f3ff; /* Lighter blue on hover */
          transition: background-color 0.2s ease;
        }

        .top-performer {
          background-color: #dbeafe !important; /* Tailwind blue-100 */
          font-weight: 600;
          color: #1e40af; /* Tailwind blue-800 */
        }
        .top-performer td {
          border-top: 2px solid #93c5fd; /* Tailwind blue-300 */
          border-bottom: 2px solid #93c5fd; /* Tailwind blue-300 */
        }
      `}</style>
      <div className="dashboard-summary">
        <SummaryCard label="Total Sales" value={`KES ${totalSales.toLocaleString()}`} animationDelay="0.1s" />
        <SummaryCard label="Transactions" value={totalTransactions} animationDelay="0.2s" />
        <SummaryCard label="Staff" value={totalStaff} animationDelay="0.3s" />
      </div>
      <h2>Admin Dashboard</h2>
      <div style={{marginBottom:'1.5rem',color:'#888'}}>Welcome, {user.name} (admin)</div>
      {loading ? <div className="dashboard-loading">Loading dashboard...</div> : error ? <div className="error">{error}</div> : (
        <>
          <div className="dashboard-widgets">
            <div className="dashboard-widget animated-card glass-bg">
              <h3>Sales by Staff</h3>
              <DashboardChart data={userChartData} type="bar" options={{responsive:true, maintainAspectRatio: false, plugins:{legend:{display:false}}}} />
            </div>
            <div className="dashboard-widget animated-card glass-bg">
              <h3>Payment Methods</h3>
              <DashboardChart data={paymentChartData} type="pie" options={{responsive:true, maintainAspectRatio: false, plugins:{legend:{position:'bottom'}}}} />
            </div>
            <div className="dashboard-widget animated-card glass-bg">
              <h3>Top Products</h3>
              <DashboardChart data={topProductsChartData} type="bar" options={{responsive:true, maintainAspectRatio: false, plugins:{legend:{display:false}}}} />
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
                    <td>{s.shift || '-'}</td> {/* Added fallback for shift */}
                    <td>KES {(salesByUser[s.name] || 0).toLocaleString()}</td>
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
