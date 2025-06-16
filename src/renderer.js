document.getElementById('root').innerHTML = 'React is rendering...';
/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */
import './index.css';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import LoginPage from './pages/LoginPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import AdminDashboard from './pages/AdminDashboard';
import StaffPage from './pages/StaffPage';
import ShiftPage from './pages/ShiftPage';

function ThemeToggle() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('theme') || 'light');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  return (
    <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle dark mode">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

function Sidebar({ user, page, setPage }) {
  return (
    <aside className="sidebar">
      <h2>GG Liquor POS</h2>
      <ThemeToggle />
      <nav>
        <button className={page === 'inventory' ? 'active' : ''} onClick={() => setPage('inventory')}>Inventory</button>
        <button className={page === 'sales' ? 'active' : ''} onClick={() => setPage('sales')}>Sales</button>
        <button className={page === 'shift' ? 'active' : ''} onClick={() => setPage('shift')}>Shift</button>
        {user.role === 'admin' && <>
          <button className={page === 'reports' ? 'active' : ''} onClick={() => setPage('reports')}>Reports</button>
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button>
          <button className={page === 'staff' ? 'active' : ''} onClick={() => setPage('staff')}>Staff</button>
        </>}
        <button onClick={() => window.location.reload()}>Logout</button>
      </nav>
    </aside>
  );
}

const App = () => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('inventory');
  const [items, setItems] = useState([]);

  const handleLogin = async (username, password) => {
    setError('');
    try {
      const result = await window.api.login(username, password);
      if (result.success) {
        setUser(result.user);
        setPage(result.user.role === 'admin' ? 'dashboard' : 'inventory');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (e) {
      setError('Login error');
    }
  };

  React.useEffect(() => {
    const fetchData = async () => {
      if (user) {
        try {
          const result = await window.api.getInventory();
          if (result.success) {
            setItems(Array.isArray(result.items) ? result.items : []);
          } else {
            setItems([]);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
          setItems([]);
        }
      }
    };

    fetchData();
  }, [user]);

  const handleCheckIn = async (item) => {
    console.log('Sending to check-in:', item);
    try {
      const result = await window.api.checkIn(item); // Use checkIn, not invoke
      console.log('Check-in result:', result);
      if (result.success) {
        // Optionally, fetch all items again to refresh the list
        const updated = await window.api.getInventory();
        setItems(Array.isArray(updated.items) ? updated.items : []);
      } else {
        console.error('Check-in failed:', result.error);
      }
    } catch (error) {
      console.error('Error during check-in:', error);
    }
  };

  if (!user) {
    return <div className="main-content"><LoginPage onLogin={handleLogin} error={error} /></div>;
  }

  return (
    <div className="app-container">
      <Sidebar user={user} page={page} setPage={setPage} />
      <main className="main-content">
        {page === 'inventory' && <InventoryPage user={user} items={items} onCheckIn={handleCheckIn} />}
        {page === 'sales' && <SalesPage user={user} />}
        {page === 'reports' && user.role === 'admin' && <ReportsPage user={user} />}
        {page === 'dashboard' && user.role === 'admin' && <AdminDashboard user={user} />}
        {page === 'staff' && user.role === 'admin' && <StaffPage user={user} />}
        {page === 'shift' && <ShiftPage user={user} />}
      </main>
    </div>
  );
};

console.log('renderer.js loaded');
const rootDiv = document.getElementById('root');
console.log('rootDiv:', rootDiv);
if (rootDiv) {
  const root = createRoot(rootDiv);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('React root.render called');
} else {
  console.error('Root div not found!');
}

console.log('👋 This message is being logged by "renderer.js", included via webpack');
