// src/pages/SalesPage.js
// Sales/checkout page

import React, { useState, useEffect, useRef } from 'react';
import BarcodeInput, { CATEGORY_OPTIONS } from '../components/BarcodeInput';

function SalesPage({ user }) {
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [scannedBarcodes, setScannedBarcodes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const barcodeInputRef = useRef();

  // Fetch inventory on mount
  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      const result = await window.api.getAllItems();
      setLoading(false);
      if (result.success) {
        // Demo: add image for Johnnie Walker Red
        const itemsWithImages = result.items.map(item => {
          if (item.category === 'Whisky' && item.subcategory === 'Johnnie Walker Red') {
            return { ...item, image: 'johnnie-walker-red.png', stock: item.stock || 1 };
          }
          return { ...item, image: item.image || 'placeholder.png', stock: item.stock || 1 };
        });
        setInventory(itemsWithImages);
      } else setInventory([]);
    };
    fetchInventory();
  }, []);

  // Add item to cart from inventory table
  const handleAddToCart = (item) => {
    if (cart.find(i => i.barcode === item.barcode)) return;
    setCart([...cart, item]);
    setSelectedItem(item); // Show item details with image
  };

  // Remove item from cart
  const handleRemoveFromCart = (barcode) => {
    setCart(cart.filter(item => item.barcode !== barcode));
    setScannedBarcodes(scannedBarcodes.filter(b => b !== barcode));
  };

  // Scan barcode for checkout
  const handleBarcodeScan = (code) => {
    if (cart.find(i => i.barcode === code) && !scannedBarcodes.includes(code)) {
      setScannedBarcodes([...scannedBarcodes, code]);
      setMessage('Barcode scanned: ' + code);
    } else {
      setMessage('Barcode not in cart or already scanned.');
    }
  };

  // Manual barcode entry for checkout
  const handleManualBarcodeEntry = () => {
    if (!manualBarcode) return setMessage('Enter a barcode.');
    if (cart.find(i => i.barcode === manualBarcode) && !scannedBarcodes.includes(manualBarcode)) {
      setScannedBarcodes([...scannedBarcodes, manualBarcode]);
      setMessage('Barcode entered: ' + manualBarcode);
      setManualBarcode('');
    } else {
      setMessage('Barcode not in cart or already scanned.');
    }
  };

  // Complete sale
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setMessage('Cart is empty.');
      return;
    }
    if (scannedBarcodes.length !== cart.length) {
      setMessage('Please scan all barcodes in the cart before checkout.');
      return;
    }
    setLoading(true);
    setMessage('');
    const result = await window.api.checkoutSale({
      userId: user.id,
      shift: user.shift,
      items: cart.map(item => ({ itemId: item.id, barcode: item.barcode })),
      paymentMethod,
      createdAt: new Date().toISOString(),
      customerName,
    });
    setLoading(false);
    if (result.success) {
      setCart([]);
      setScannedBarcodes([]);
      setCustomerName('');
      setMessage('Sale recorded successfully!');
      setShowSaleForm(false);
    } else {
      setMessage(result.error || 'Checkout failed');
    }
  };

  return (
    <div className="sales-page card">
      <h2>Sales / Checkout</h2>
      <div style={{marginBottom: '1.5rem', color: '#888'}}>Welcome, {user.name} ({user.role})</div>
      <h3>Inventory</h3>
      <div className="inventory-list">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Barcode</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Sell Price</th>
              <th>Stock</th>
              <th>Add</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map(item => (
              <tr key={item.barcode} className={selectedItem && selectedItem.barcode === item.barcode ? 'selected' : ''}>
                <td>
                  <img src={item.image ? require(`../assets/${item.image}`) : require('../assets/placeholder.png')} alt={item.category} style={{width:48, height:48, borderRadius:8}} onClick={() => setSelectedItem(item)} />
                </td>
                <td>{item.barcode}</td>
                <td>{item.category}</td>
                <td>{item.subcategory}</td>
                <td>{item.priceSell}</td>
                <td>{item.stock || 1}</td>
                <td><button type="button" onClick={() => handleAddToCart(item)} disabled={cart.find(i => i.barcode === item.barcode)}>Add</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedItem && (
          <div className="item-details-modal">
            <img src={selectedItem.image ? require(`../assets/${selectedItem.image}`) : require('../assets/placeholder.png')} alt={selectedItem.category} style={{width:120, height:120, borderRadius:12}} />
            <h3>{selectedItem.category} - {selectedItem.subcategory}</h3>
            <div>Barcode: {selectedItem.barcode}</div>
            <div>Sale Price: <b>KES {selectedItem.priceSell}</b></div>
            <div>Stock: {selectedItem.stock || 1}</div>
            <button onClick={() => setSelectedItem(null)}>Close</button>
          </div>
        )}
      </div>
      <h3>Cart</h3>
      <table>
        <thead>
          <tr>
            <th>Barcode</th>
            <th>Category</th>
            <th>Subcategory</th>
            <th>Sell Price</th>
            <th>Remove</th>
            <th>Scanned</th>
          </tr>
        </thead>
        <tbody>
          {cart.map(item => (
            <tr key={item.barcode}>
              <td>{item.barcode}</td>
              <td>{item.category}</td>
              <td>{item.subcategory}</td>
              <td>{item.priceSell}</td>
              <td><button type="button" onClick={() => handleRemoveFromCart(item.barcode)}>Remove</button></td>
              <td>{scannedBarcodes.includes(item.barcode) ? '✔️' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setShowSaleForm(true)} disabled={cart.length === 0}>Proceed to Sale</button>
      {showSaleForm && (
        <div className="card" style={{marginTop: '2rem'}}>
          <h3>Sale Information</h3>
          <label>Customer Name (optional):</label>
          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer Name" />
          <label>Payment Method:</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
          </select>
          <h4>Scan each item barcode to confirm checkout:</h4>
          <BarcodeInput onScan={handleBarcodeScan} ref={barcodeInputRef} />
          <div style={{marginTop:'1rem'}}>
            <input type="text" value={manualBarcode} onChange={e => setManualBarcode(e.target.value)} placeholder="Enter barcode manually" style={{marginRight:'1rem'}} />
            <button type="button" onClick={handleManualBarcodeEntry}>Enter Barcode</button>
          </div>
          <button onClick={handleCheckout} disabled={loading || scannedBarcodes.length !== cart.length}>{loading ? 'Processing...' : 'Complete Sale'}</button>
        </div>
      )}
      {message && <div className={message.includes('success') ? 'success' : 'error'}>{message}</div>}
    </div>
  );
}

export default SalesPage;
