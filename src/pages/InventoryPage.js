// src/pages/InventoryPage.js
// Inventory display and check-in page

import React, { useEffect, useState, useRef } from 'react';
import BarcodeInput, { CATEGORY_OPTIONS } from '../components/BarcodeInput';
import InventoryCheckInPage from './InventoryCheckInPage';

function InventoryTable({ items }) {
  // Group by category/subcategory
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = {};
    if (!grouped[item.category][item.subcategory]) grouped[item.category][item.subcategory] = [];
    grouped[item.category][item.subcategory].push(item);
  });
  return (
    <div style={{marginTop: '2rem'}}>
      {Object.keys(grouped).map(category => (
        <div key={category} style={{marginBottom: '2rem'}}>
          <h3>{category}</h3>
          {Object.keys(grouped[category]).map(sub => (
            <div key={sub} style={{marginBottom: '1rem'}}>
              <h4 style={{marginLeft: '1rem'}}>{sub}</h4>
              <table>
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Status</th>
                    <th>Buy Price</th>
                    <th>Sell Price</th>
                    <th>Discount</th>
                    <th>Checked In</th>
                    <th>Image</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[category][sub].map(item => (
                    <tr key={item.barcode}>
                      <td>{item.barcode}</td>
                      <td>{item.status}</td>
                      <td>{item.priceBuy}</td>
                      <td>{item.priceSell}</td>
                      <td>{item.discount}</td>
                      <td>{item.checkedInAt && item.checkedInAt.split('T')[0]}</td>
                      <td>
                        {item.image ? (
                          <img src={item.image} alt="Item" style={{width: 50, height: 50, objectFit: 'cover'}} />
                        ) : (
                          <div style={{width: 50, height: 50, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            No Image
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function InventoryPage({ user }) {
  const [step, setStep] = useState('checkin'); // 'checkin' | 'barcode' | 'scan' | 'list'
  const [checkInData, setCheckInData] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = user.role === 'admin';

  // Step 1: Check-in form submission
  const handleCheckInSubmit = async (data) => {
    setCheckInData(data);
    setStep('barcode');

    const result = await window.api.checkIn(data);
    if (result.success) {
      fetchItems();
    } else {
      alert(result.error || 'Check-in failed');
    }
  };

  // Step 2: After barcode generation/printing
  const handleBarcodesGenerated = (generatedBarcodes) => {
    setBarcodes(generatedBarcodes);
    setStep('scan');
  };

  // Step 3: After all barcodes are scanned and checked in
  const handleScanComplete = () => {
    setStep('list');
  };

  // Fetch all items for display
  const fetchItems = async () => {
    setLoading(true);
    const result = await window.api.getAllItems();
    setLoading(false);
    if (result.success) {
      const itemsWithImages = result.items.map(item => {
        return { ...item, image: item.image || 'placeholder.png', stock: item.stock || 1 };
      });
      setItems(itemsWithImages);
    } else setItems([]);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div className="inventory-page card">
      <h2>Inventory</h2>
      <div style={{marginBottom: '1.5rem', color: '#888'}}>Welcome, {user.name} ({user.role})</div>
      {isAdmin && step === 'checkin' && (
        <InventoryCheckInPage onSubmit={handleCheckInSubmit} />
      )}
      {step === 'barcode' && checkInData && (
        // BarcodeGenerationPage will generate and display barcodes, allow printing
        <div>Barcode Generation Page (To be created)</div>
      )}
      {step === 'scan' && barcodes.length > 0 && (
        // BarcodeScanCheckInPage will prompt admin to scan each barcode for DB check-in
        <div>Barcode Scan Check-In Page (To be created)</div>
      )}
      {step === 'list' && (
        <InventoryTable items={items} />
      )}
    </div>
  );
}

export default InventoryPage;
