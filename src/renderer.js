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
import InitialAdminSetupPage from './pages/InitialAdminSetupPage';
import PasswordChangePage from './pages/PasswordChangePage';
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

function Sidebar({ user, page, setPage, onLogout }) {
  const isManager = ['admin', 'owner'].includes(user.role);
  return (
    <aside className="sidebar">
      <h2>GG Liquor POS</h2>
      <ThemeToggle />
      <nav>
        <button className={page === 'inventory' ? 'active' : ''} onClick={() => setPage('inventory')}>Inventory</button>
        <button className={page === 'sales' ? 'active' : ''} onClick={() => setPage('sales')}>Sales</button>
        <button className={page === 'shift' ? 'active' : ''} onClick={() => setPage('shift')}>Shift</button>
        {isManager && <>
          <button className={page === 'reports' ? 'active' : ''} onClick={() => setPage('reports')}>Reports</button>
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button>
          <button className={page === 'staff' ? 'active' : ''} onClick={() => setPage('staff')}>Staff</button>
        </>}
        <button onClick={onLogout}>Logout</button>
      </nav>
    </aside>
  );
}

const App = () => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('inventory');
  const [setupState, setSetupState] = useState(() => window.api ? 'checking' : 'browser');
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setLogoutError('');
    try {
      if (typeof window.api?.logout !== 'function') throw new Error('Sign out is unavailable in this desktop build.');
      const result = await window.api.logout();
      if (!result?.success) throw new Error(result?.error || 'Could not sign out.');
      setUser(null);
      setPage('inventory');
    } catch (logoutFailure) {
      console.error('Logout failed:', logoutFailure);
      setLogoutError(logoutFailure.message || 'Could not sign out.');
    }
  };

  React.useEffect(() => {
    let mounted = true;
    const checkSetup = async () => {
      if (!window.api) {
        setSetupState('browser');
        return;
      }
      try {
        if (typeof window.api.getSetupStatus !== 'function') throw new Error('This desktop app needs an update to check first-time setup.');
        const result = await window.api.getSetupStatus();
        if (!result?.success) throw new Error(result?.error || 'Could not check first-time setup.');
        if (mounted) setSetupState(result.needsSetup ? 'required' : 'ready');
      } catch (checkError) {
        console.error('Initial setup status check failed:', checkError);
        if (mounted) {
          setSetupError(checkError.message || 'Could not check first-time setup.');
          setSetupState('error');
        }
      }
    };
    checkSetup();
    return () => { mounted = false; };
  }, []);

  const handleCreateInitialAdmin = async ({ name, password }) => {
    setSetupError('');
    setSetupLoading(true);
    try {
      if (typeof window.api?.createInitialAdmin !== 'function') throw new Error('Administrator setup is unavailable in this desktop build.');
      const result = await window.api.createInitialAdmin({ name, password });
      if (!result?.success || !result.user) throw new Error(result?.error || 'Administrator could not be created.');
      setUser(result.user);
      setPage(['admin', 'owner'].includes(result.user.role) ? 'dashboard' : 'inventory');
      setSetupState('ready');
    } catch (createError) {
      console.error('Initial administrator setup failed:', createError);
      setSetupError(createError.message || 'Administrator setup failed.');
      try {
        const status = await window.api.getSetupStatus();
        if (status?.success && !status.needsSetup) setSetupState('ready');
      } catch (statusError) {
        console.error('Setup status recheck failed:', statusError);
      }
    } finally {
      setSetupLoading(false);
    }
  };

  const handleLogin = async (username, password) => {
    setError('');
    if (!window.api?.login) {
      setError('Login is only available in the desktop app. Start it with npm start.');
      return;
    }

    try {
      const result = await window.api.login(username, password);
      if (result.success) {
        setUser(result.user);
        setPage(['admin', 'owner'].includes(result.user.role) ? 'dashboard' : 'inventory');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (e) {
      console.error('Login request failed:', e);
      setError('Login error');
    }
  };

  if (setupState === 'checking') {
    return <main className="main-content setup-state-content"><section className="card narrow-card"><p className="eyebrow">Application startup</p><h1>Checking setup…</h1><p className="muted">Verifying whether this desktop installation needs its first administrator.</p></section></main>;
  }

  if (setupState === 'error') {
    return <main className="main-content setup-state-content"><section className="card narrow-card"><p className="eyebrow">Application startup</p><h1>Could not check setup</h1><div className="error" role="alert">{setupError}</div><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Retry</button></section></main>;
  }

  if (setupState === 'required') {
    return <main className="main-content setup-state-content"><InitialAdminSetupPage onCreateAdmin={handleCreateInitialAdmin} error={setupError} loading={setupLoading} /></main>;
  }

  if (!user) {
    return <div className="main-content"><LoginPage onLogin={handleLogin} error={error} />{setupState === 'browser' && <div className="browser-preview-notice" role="note"><strong>Browser preview only</strong><span>Authentication and inventory APIs are available only in the Electron desktop app. No browser session is authenticated.</span></div>}</div>;
  }

  if (user.mustChangePassword) {
    return <PasswordChangePage user={user} onComplete={() => setUser(current => ({ ...current, mustChangePassword: false }))} />;
  }

  return (
    <div className="app-container">
      <Sidebar user={user} page={page} setPage={setPage} onLogout={handleLogout} />
      <main className="main-content">
        {logoutError && <div className="error" role="alert">{logoutError}</div>}
        {page === 'inventory' && <InventoryPage user={user} />}
        {page === 'sales' && <SalesPage user={user} />}
        {page === 'reports' && ['admin', 'owner'].includes(user.role) && <ReportsPage user={user} />}
        {page === 'dashboard' && ['admin', 'owner'].includes(user.role) && <AdminDashboard user={user} />}
        {page === 'staff' && ['admin', 'owner'].includes(user.role) && <StaffPage user={user} />}
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
