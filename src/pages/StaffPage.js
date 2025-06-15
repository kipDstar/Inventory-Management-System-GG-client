import React, { useEffect, useState } from 'react';

function StaffPage({ user }) {
  const [staff, setStaff] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', password: '', shift: 'day' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    const result = await window.api.getAllStaff();
    setLoading(false);
    if (result.success) setStaff(result.staff);
    else setStaff([]);
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    const result = await window.api.addStaff(newStaff);
    setLoading(false);
    if (result.success) {
      setMessage('Staff user created!');
      setNewStaff({ name: '', password: '', shift: 'day' });
      fetchStaff();
    } else {
      setMessage(result.error || 'Failed to add staff');
    }
  };

  return (
    <div className="admin-dashboard card">
      <h2>Staff Management</h2>
      <form onSubmit={handleAddStaff} style={{marginBottom: '2rem'}}>
        <h3>Add Sales Staff</h3>
        <input type="text" placeholder="Username" value={newStaff.name} onChange={e => setNewStaff(s => ({...s, name: e.target.value}))} required />
        <input type="password" placeholder="Password" value={newStaff.password} onChange={e => setNewStaff(s => ({...s, password: e.target.value}))} required />
        <select value={newStaff.shift} onChange={e => setNewStaff(s => ({...s, shift: e.target.value}))}>
          <option value="day">Day Shift</option>
          <option value="night">Night Shift</option>
        </select>
        <button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Staff'}</button>
      </form>
      {message && <div className={message.includes('created') ? 'success' : 'error'}>{message}</div>}
      <h3>Current Sales Staff</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Shift</th>
            <th>Performance</th>
            <th>Special Issues</th>
            <th>Check In</th>
            <th>Check Out</th>
          </tr>
        </thead>
        <tbody>
          {staff.map(s => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.shift}</td>
              <td>{s.performance || '-'}</td>
              <td>{s.issues || '-'}</td>
              <td>{s.checkIn || '-'}</td>
              <td>{s.checkOut || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StaffPage;