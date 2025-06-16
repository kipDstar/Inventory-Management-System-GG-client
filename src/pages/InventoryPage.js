// src/pages/InventoryPage.js
// Inventory display and check-in page

import React, { useEffect, useState } from 'react';
import InventoryCheckInPage from './InventoryCheckInPage';
import BarcodeGenerationPage from './BarcodeGenerationPage';
import BarcodeScanCheckInPage from './BarcodeScanCheckInPage';
import InventoryList from './InventoryList';

function InventoryPage({ user }) {
  const [step, setStep] = useState('list'); // Default to 'list'
  const [checkInData, setCheckInData] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const isAdmin = user.role === 'admin';

  // Handler to start new stock workflow
  const handleNewStock = () => setStep('checkin');

  // Step 1: Check-in form submission
  const handleCheckInSubmit = (data) => {
    setCheckInData(data);
    setStep('barcode');
  };

  // Step 2: After barcode generation/printing
  const handleBarcodesGenerated = (generatedBarcodes) => {
    setBarcodes(generatedBarcodes);
    setStep('scan');
  };

  // Step 3: After all barcodes are scanned and checked in
  const handleScanComplete = async () => {
    await window.api.addInventoryItems({ ...checkInData, barcodes });
    setStep('list');
    fetchItems(); // Refresh inventory after check-in
  };

  // Fetch all items for display
  const fetchItems = async () => {
    setLoading(true);
    const result = await window.api.getAllItems();
    setLoading(false);
    if (result.success) {
      const itemsWithImages = result.items.map(item => ({
        ...item,
        image: item.image || 'placeholder.png',
        stock: item.stock || 1,
      }));
      setItems(itemsWithImages);
    } else setItems([]);
  };

  const handleCheckIn = async (item) => {
    console.log('UI check-in called with:', item);
    const result = await window.api.checkIn(item);
    console.log('UI check-in result:', result);
    // ...rest of your code...
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div className="inventory-page card">
      <h2>Inventory</h2>
      <div style={{ marginBottom: '1.5rem', color: '#888' }}>
        Welcome, {user.name} ({user.role})
      </div>
      {step === 'list' && (
        <>
          {isAdmin && (
            <button className="animated-btn" style={{ marginBottom: 24 }} onClick={handleNewStock}>
              + New Stock
            </button>
          )}
          <InventoryList items={items} loading={loading} />
        </>
      )}
      {isAdmin && step === 'checkin' && (
        <InventoryCheckInPage onSubmit={handleCheckInSubmit} />
      )}
      {step === 'barcode' && checkInData && (
        <BarcodeGenerationPage
          checkInData={checkInData}
          onComplete={handleBarcodesGenerated}
        />
      )}
      {step === 'scan' && barcodes.length > 0 && (
        <BarcodeScanCheckInPage
          barcodes={barcodes}
          checkInData={checkInData}
          onComplete={handleScanComplete}
        />
      )}
    </div>
  );
}

export default InventoryPage;
