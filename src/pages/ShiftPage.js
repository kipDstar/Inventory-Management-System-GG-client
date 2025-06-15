import React, { useState } from 'react';

function ShiftPage({ user }) {
  const [shiftStatus, setShiftStatus] = useState(user.shiftStatus || 'out');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);
    const result = await window.api.shiftCheckIn(user.id);
    setLoading(false);
    if (result.success) {
      setShiftStatus('in');
      setMessage('Checked in for shift!');
    } else {
      setMessage(result.error || 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    const result = await window.api.shiftCheckOut(user.id);
    setLoading(false);
    if (result.success) {
      setShiftStatus('out');
      setMessage('Checked out of shift!');
    } else {
      setMessage(result.error || 'Check-out failed');
    }
  };

  return (
    <div className="card" style={{maxWidth: 400, margin: '2rem auto'}}>
      <h2>Shift Management</h2>
      <div>Status: <b>{shiftStatus === 'in' ? 'Checked In' : 'Checked Out'}</b></div>
      <button onClick={handleCheckIn} disabled={shiftStatus === 'in' || loading}>Check In</button>
      <button onClick={handleCheckOut} disabled={shiftStatus === 'out' || loading} style={{marginLeft: 10}}>Check Out</button>
      {message && <div className={message.includes('!') ? 'success' : 'error'}>{message}</div>}
    </div>
  );
}

export default ShiftPage;