// src/components/BarcodeInput.js
// Barcode input field for USB barcode scanner

import React, { useRef, useEffect, useState } from 'react';

const CATEGORY_OPTIONS = [
  { label: 'Beer', value: 'Beer', subcategories: [
    'Balozi (500ml)', 'Tusker (500ml)', 'Tusker Lite (500ml)', 'White Cap (500ml)', 'Pilsner (500ml)', 'Guinness (500ml)', 'Heineken (500ml)', 'Summit Lager (500ml)', 'Summit Malt (500ml)'
  ]},
  { label: 'Wine', value: 'Wine', subcategories: [
    '4th Street Red', '4th Street White', 'Cellar Cask', 'Drostdy-Hof', 'Robertson', 'Nederburg', 'Chamdor', 'Granulated', 'Sweet Lips'
  ]},
  { label: 'Soda', value: 'Soda', subcategories: [
    'Coca Cola (500ml)', 'Fanta (500ml)', 'Sprite (500ml)', 'Krest (500ml)', 'Stoney (500ml)'
  ]},
  { label: 'Water', value: 'Water', subcategories: [
    'Keringet (500ml)', 'Dasani (500ml)', 'Aquamist (500ml)', 'Highlands (500ml)'
  ]},
  { label: 'Liquor', value: 'Liquor', subcategories: [
    'Johnnie Walker Red', 'Johnnie Walker Black', 'Jameson', 'Glenfiddich', 'Smirnoff Vodka', 'Gilbeys Gin', 'Chrome Vodka', 'Kenya Cane', 'Captain Morgan'
  ]},
  { label: 'Mixers', value: 'Mixers', subcategories: [
    'Schweppes Tonic', 'Schweppes Soda', 'Red Bull', 'Monster', 'Fitch & Leedes', 'Bitter Lemon'
  ]},
];

function BarcodeInput({ onScan }) {
  const inputRef = useRef();
  const [manual, setManual] = useState(false);
  const [value, setValue] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (showPrompt && inputRef.current && !manual) {
      inputRef.current.focus();
    }
  }, [showPrompt, manual]);

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);
    if (val.length > 5 && !manual) { // likely a barcode scan
      onScan(val);
      setValue('');
      setShowPrompt(false);
    }
  };

  const handleManual = () => {
    setManual(true);
    setShowPrompt(false);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 100);
  };

  const handleInputClick = () => {
    setShowPrompt(true);
    setManual(false);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 100);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (value.length > 0) {
      onScan(value);
      setValue('');
      setManual(false);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={manual ? 'Enter barcode manually...' : 'Click to scan barcode...'}
        value={value}
        onChange={handleChange}
        onClick={handleInputClick}
        style={{ width: manual || showPrompt ? '100%' : 1, opacity: manual || showPrompt ? 1 : 0, position: manual || showPrompt ? 'static' : 'absolute', left: manual || showPrompt ? 0 : '-9999px' }}
        tabIndex={manual || showPrompt ? 0 : -1}
      />
      {showPrompt && !manual && (
        <div style={{ margin: '0.5rem 0', color: '#232946', fontWeight: 500 }}>
          Please scan a barcode, or <button type="button" style={{ color: '#232946', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }} onClick={handleManual}>enter manually</button>.
        </div>
      )}
      {manual && (
        <form onSubmit={handleManualSubmit} style={{ marginTop: '0.5rem' }}>
          <button type="submit">Submit Barcode</button>
        </form>
      )}
    </div>
  );
}

export { CATEGORY_OPTIONS };
export default BarcodeInput;
