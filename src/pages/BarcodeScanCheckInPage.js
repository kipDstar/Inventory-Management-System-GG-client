import React, { useState } from 'react';
import BarcodeInput from '../components/BarcodeInput';

export default function BarcodeScanCheckInPage({ barcodes, onComplete, saving = false }) {
  const [confirmed, setConfirmed] = useState([]);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const saveBatch = async () => {
    setError('');
    const result = await onComplete();
    if (result) setComplete(true);
  };

  const handleScan = async code => {
    if (confirmed.includes(code)) {
      setError('This barcode was already scanned. Scan a different label.');
      return;
    }
    if (!barcodes.includes(code)) {
      setError('Barcode is not part of this stock batch. Check the label and try again.');
      return;
    }
    setError('');
    const nextConfirmed = [...confirmed, code];
    setConfirmed(nextConfirmed);
    if (nextConfirmed.length === barcodes.length) await saveBatch();
  };

  return (
    <section className="barcode-scan-card">
      <h2>Verify stock barcodes</h2>
      <p>Scan or type each label in any order. Each barcode must be confirmed once before the batch is saved.</p>
      <BarcodeInput onScan={handleScan} disabled={saving || complete} />
      <div className="progress-track" aria-label={`${confirmed.length} of ${barcodes.length} barcodes scanned`}>
        <span style={{ width: `${barcodes.length ? (confirmed.length / barcodes.length) * 100 : 0}%` }} />
      </div>
      <p className="muted">Confirmed: {confirmed.length} / {barcodes.length}</p>
      {saving && <p role="status">Saving stock intake…</p>}
      {error && <div className="error" role="alert">{error}</div>}
      {confirmed.length === barcodes.length && !complete && !saving && (
        <button type="button" onClick={saveBatch}>Retry saving this batch</button>
      )}
      {complete && <div className="success" role="status">All items were checked in successfully.</div>}
    </section>
  );
}
