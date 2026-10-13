import React, { useCallback, useEffect, useState } from 'react';

function formatDate(value) {
  if (!value || value === '—') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function staffRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.staff)) return result.staff;
  if (Array.isArray(result?.rows)) return result.rows;
  if (result?.success === false) throw new Error(result.error || 'Could not load staff.');
  return [];
}

function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', password: '', shift: 'day' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStaff(staffRows(await window.api.getAllStaff()));
    } catch (fetchError) {
      console.error('Staff load failed:', fetchError);
      setError(fetchError.message || 'Could not load staff.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleAddStaff = async event => {
    event.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const result = await window.api.addStaff(newStaff);
      if (!result?.success) throw new Error(result?.error || 'Failed to add staff.');
      setMessage('Staff user created.');
      setNewStaff({ name: '', password: '', shift: 'day' });
      await fetchStaff();
    } catch (addError) {
      console.error('Staff creation failed:', addError);
      setError(addError.message || 'Failed to add staff.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="staff-page card page-card">
      <header className="page-heading"><div><p className="eyebrow">Team</p><h1>Staff management</h1><p className="muted">Current shift activity and performance.</p></div><button type="button" className="secondary-button" onClick={fetchStaff} disabled={loading}>Refresh</button></header>
      {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
      <form className="staff-form panel" onSubmit={handleAddStaff}>
        <h2>Add sales staff</h2>
        <label>Username<input type="text" value={newStaff.name} onChange={event => setNewStaff(current => ({ ...current, name: event.target.value }))} required autoComplete="off" /></label>
        <label>Password<input type="password" value={newStaff.password} onChange={event => setNewStaff(current => ({ ...current, password: event.target.value }))} required minLength={10} autoComplete="new-password" /></label>
        <label>Default shift<select value={newStaff.shift} onChange={event => setNewStaff(current => ({ ...current, shift: event.target.value }))}><option value="day">Day shift</option><option value="night">Night shift</option></select></label>
        <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Adding…' : 'Add staff'}</button>
      </form>
      <section className="panel"><h2>Staff shift performance</h2>
        {loading ? <p className="loading-state">Loading staff…</p> : <div className="table-scroll"><table>
          <thead><tr><th>Name</th><th>Shift status</th><th>Check in</th><th>Check out</th><th>Shift revenue</th><th>Sales</th><th>Items sold</th></tr></thead>
          <tbody>{staff.map((member, index) => <tr key={member.id ?? index}>
            <td>{member.name}</td>
            <td>{member.activeShiftId ? <span className="status-badge status-success">Active shift</span> : <span className="status-badge">Off shift</span>}</td>
            <td>{formatDate(member.checkIn)}</td>
            <td>{formatDate(member.checkOut)}</td>
            <td>KES {Number(member.shiftRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>{member.shiftSalesCount ?? 0}</td><td>{member.itemsSold ?? 0}</td>
          </tr>)}{!staff.length && <tr><td colSpan="7" className="empty-cell">No staff records.</td></tr>}</tbody>
        </table></div>}
      </section>
    </section>
  );
}

export default StaffPage;
