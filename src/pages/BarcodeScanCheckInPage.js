import React, { useState } from 'react';
import BarcodeInput from '../components/BarcodeInput';

export default function BarcodeScanCheckInPage({ barcodes, checkInData, onComplete }) {
  const [confirmed, setConfirmed] = useState([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);

  const handleScan = (code) => {
    if (code === barcodes[current]) {
      setConfirmed([...confirmed, code]);
      setError('');
      if (current + 1 < barcodes.length) {
        setCurrent(current + 1);
      } else {
        onComplete();
      }
    } else {
      setError('Scanned or entered barcode does not match the expected item!');
    }
  };

  return (
    <div className="barcode-scan-card">
      <h2>Scan or Enter Each Barcode to Check In</h2>
      <p>
        Scan barcode for item {current + 1} of {barcodes.length}:<br />
        <button
          type="button"
          className="animated-btn"
          style={{ marginTop: 8, marginBottom: 8 }}
          onClick={() => setManual(m => !m)}
        >
          {manual ? 'Switch to Scanner Mode' : 'Enter Manually'}
        </button>
      </p>
      <BarcodeInput onScan={handleScan} manual={manual} />
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        Confirmed: {confirmed.length} / {barcodes.length}
      </div>
    </div>
  );
}