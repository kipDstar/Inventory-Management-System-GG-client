import React, { useCallback, useEffect, useState } from 'react';

function shiftIsActive(shift) {
  if (!shift) return false;
  if (typeof shift === 'string') return ['in', 'active', 'checked_in'].includes(shift.toLowerCase());
  if (shift.activeShiftId) return true;
  const status = String(shift.status || shift.state || '').toLowerCase();
  if (['out', 'inactive', 'closed', 'checked_out'].includes(status)) return false;
  if (['in', 'active', 'open', 'checked_in'].includes(status)) return true;
  const checkIn = shift.checkIn || shift.check_in;
  const checkOut = shift.checkOut || shift.check_out;
  return Boolean(checkIn && !checkOut);
}

function ShiftPage({ user }) {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.api.getShiftStatus();
      if (result?.success === false) throw new Error(result.error || 'Could not load shift status.');
      setShift(result?.shift ?? result ?? null);
    } catch (loadError) {
      console.error('Shift status load failed:', loadError);
      setError(loadError.message || 'Could not load shift status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const active = shiftIsActive(shift);
  const shiftTime = shift?.checkIn || shift?.check_in || shift?.startedAt;

  const updateShift = async action => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = action === 'in' ? await window.api.shiftCheckIn() : await window.api.shiftCheckOut();
      if (!result?.success) throw new Error(result?.error || `Could not check ${action === 'in' ? 'in' : 'out'} of shift.`);
      setMessage(action === 'in' ? 'You are checked in. Sales are now enabled.' : 'You are checked out. New sales are disabled.');
      await refresh();
    } catch (updateError) {
      console.error('Shift update failed:', updateError);
      setError(updateError.message || 'Shift update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="shift-page card page-card narrow-card">
      <p className="eyebrow">Attendance</p>
      <h1>Shift management</h1>
      <p className="muted">{user.name}</p>
      {loading ? <p className="loading-state">Checking your shift…</p> : <>
        <div className={`shift-status-card ${active ? 'is-active' : 'is-inactive'}`}>
          <span className="status-dot" />
          <div><strong>{active ? 'Checked in' : 'Checked out'}</strong><p>{active ? 'Your shift is active. You can record sales.' : 'Check in before starting or completing a sale.'}</p></div>
        </div>
        {shiftTime && <p className="muted">Shift started: {new Date(shiftTime).toLocaleString()}</p>}
      </>}
      {error && <div className="error" role="alert">{error} <button type="button" className="text-button" onClick={refresh}>Retry</button></div>}
      {message && <div className="success" role="status">{message}</div>}
      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => updateShift('in')} disabled={loading || saving || active}>Check in</button>
        <button type="button" className="secondary-button" onClick={() => updateShift('out')} disabled={loading || saving || !active}>Check out</button>
      </div>
      {saving && <p role="status">Updating shift…</p>}
    </section>
  );
}

export default ShiftPage;
