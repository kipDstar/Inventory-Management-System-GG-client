import React, { useState } from 'react';
import BarcodeInput from '../components/BarcodeInput';

export default function BarcodeScanCheckInPage({ barcodes, checkInData, onComplete }) {
  const [confirmed, setConfirmed] = useState([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState('');

  const handleScan = (code) => {
    if (code === barcodes[current]) {
      setConfirmed([...confirmed, code]);
      setError('');
      if (current + 1 < barcodes.length) {
        setCurrent(current + 1);
      } else {
        // All barcodes confirmed, update DB here if needed
        onComplete();
      }
    } else {
      setError('Scanned barcode does not match the expected item!');
    }
  };

  return (
    <div className="barcode-scan-card">
      <h2>Scan Each Barcode to Check In</h2>
      <p>Scan barcode for item {current + 1} of {barcodes.length}:</p>
      <BarcodeInput onScan={handleScan} />
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        Confirmed: {confirmed.length} / {barcodes.length}
      </div>
    </div>
  );
}