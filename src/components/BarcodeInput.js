// src/components/BarcodeInput.js
// Barcode input field for USB barcode scanner

import React, { useRef, useEffect, useState } from 'react';

function BarcodeInput({ onScan }) {
  const inputRef = useRef();
  const [manual, setManual] = useState(false);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [manual]);

  const handleChange = (e) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (value.trim().length > 0) {
        onScan(value.trim());
        setValue('');
      }
    }
  };

  const handleModeToggle = () => setManual((m) => !m);

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontWeight: 500 }}>
        {manual ? 'Enter barcode manually:' : 'Scan barcode:'}
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={manual ? 'Type barcode and press Enter' : 'Scan barcode...'}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          style={{
            width: 240,
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: 6,
            border: '1px solid #bbb',
            outline: 'none',
          }}
          autoFocus
        />
        <button
          type="button"
          className="animated-btn"
          onClick={handleModeToggle}
          style={{ minWidth: 120 }}
        >
          {manual ? 'Switch to Scanner Mode' : 'Enter Manually'}
        </button>
      </div>
    </div>
  );
}

export default BarcodeInput;
