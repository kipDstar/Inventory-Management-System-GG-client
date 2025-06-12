// src/components/ReportList.js
// List of reports for admin

import React, { useState } from 'react';

function ReportList({ reports, onDownload, onSendEmail, loading }) {
  const [selected, setSelected] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [downloadMsg, setDownloadMsg] = useState('');
  const [emailMsg, setEmailMsg] = useState('');

  const toggleSelect = (id) => {
    setSelected(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const handleDownload = async () => {
    setDownloadMsg('');
    const selectedReports = reports.filter(r => selected.includes(r.id));
    if (selectedReports.length === 0) return;
    setDownloadMsg('Generating PDF...');
    const result = await onDownload(selectedReports, password);
    if (result && result.success) {
      setDownloadMsg('PDF generated. Check your downloads or temp folder.');
    } else {
      setDownloadMsg(result && result.error ? result.error : 'Failed to generate PDF');
    }
  };

  const handleSendEmail = async () => {
    setEmailMsg('');
    const selectedReports = reports.filter(r => selected.includes(r.id));
    if (selectedReports.length === 0 || !email) return;
    setEmailMsg('Sending email...');
    const result = await onSendEmail(selectedReports, email, password);
    if (result && result.success) {
      setEmailMsg('Email sent successfully!');
    } else {
      setEmailMsg(result && result.error ? result.error : 'Failed to send email');
    }
  };

  return (
    <div className="report-list">
      <div style={{marginBottom:'1rem'}}>
        <input type="email" placeholder="Recipient Email" value={email} onChange={e => setEmail(e.target.value)} style={{marginRight:'1rem'}} />
        <input type="password" placeholder="PDF Password (optional)" value={password} onChange={e => setPassword(e.target.value)} style={{marginRight:'1rem'}} />
        <button onClick={handleDownload} disabled={selected.length === 0 || loading}>Download PDF</button>
        <button onClick={handleSendEmail} disabled={selected.length === 0 || !email || loading}>Send Email</button>
        {downloadMsg && <span style={{marginLeft:'1rem',color:downloadMsg.includes('success')?'green':'red'}}>{downloadMsg}</span>}
        {emailMsg && <span style={{marginLeft:'1rem',color:emailMsg.includes('success')?'green':'red'}}>{emailMsg}</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Date</th>
            <th>Salesperson</th>
            <th>Payment</th>
            <th>Items</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td>{r.createdAt && r.createdAt.split('T')[0]}</td>
              <td>{r.userName}</td>
              <td>{r.paymentMethod}</td>
              <td>{r.items && r.items.length}</td>
              <td>{r.items && r.items.reduce((sum, i) => sum + (i.priceSell - (i.discount || 0)), 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.length === 0 && <div style={{marginTop:'1rem'}}>No sales found for selected filters.</div>}
    </div>
  );
}

export default ReportList;
