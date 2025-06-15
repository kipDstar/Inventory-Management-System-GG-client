// src/pages/InventoryPage.js
// Inventory display and check-in page

import React, { useEffect, useState, useRef } from 'react';
import BarcodeInput, { CATEGORY_OPTIONS } from '../components/BarcodeInput';

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
  const [barcode, setBarcode] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priceBuy, setPriceBuy] = useState('');
  const [priceSell, setPriceSell] = useState('');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef();

  const isAdmin = user.role === 'admin';

  const handleBarcodeScan = (code) => {
    setBarcode(code);
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    setMessage('');
    let imageName = '';
    if (imageFile) {
      // Save image to assets folder (renderer process: use IPC or fallback to base64 for demo)
      const ext = imageFile.name.split('.').pop();
      imageName = `${barcode}_${Date.now()}.${ext}`;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        // Send to main process to save
        await window.api.saveItemImage(imageName, ev.target.result);
        submitCheckIn(imageName);
      };
      reader.readAsDataURL(imageFile);
      return;
    }
    submitCheckIn(imageName);
  };

  const submitCheckIn = async (imageName) => {
    const result = await window.api.checkIn({
      barcode, category, subcategory, quantity, priceBuy, priceSell, discount, image: imageName
    });
    if (result.success) {
      setMessage('Item(s) checked in successfully!');
      setBarcode(''); setCategory(''); setSubcategory(''); setQuantity(1); setPriceBuy(''); setPriceSell(''); setDiscount(''); setImageFile(null);
      fileInputRef.current.value = '';
      fetchItems();
    } else {
      setMessage(result.error || 'Check-in failed');
    }
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
      {isAdmin && (
        <form onSubmit={handleCheckIn} style={{display:'flex',flexDirection:'column',gap:'1rem',marginBottom:'2rem'}}>
          <h3>Check In Item</h3>
          <BarcodeInput onScan={handleBarcodeScan} />
          <div style={{display: 'flex', gap: '1rem'}}>
            <input type="text" placeholder="Barcode" value={barcode} onChange={e => setBarcode(e.target.value)} required />
            <input type="number" placeholder="Quantity" value={quantity} min={1} onChange={e => setQuantity(e.target.value)} required style={{maxWidth: 120}} />
          </div>
          <div style={{display: 'flex', gap: '1rem'}}>
            <select value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }} required>
              <option value="">Select Category</option>
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select value={subcategory} onChange={e => setSubcategory(e.target.value)} required disabled={!category}>
              <option value="">Select Subcategory</option>
              {category && CATEGORY_OPTIONS.find(opt => opt.value === category)?.subcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div style={{display: 'flex', gap: '1rem'}}>
            <input type="number" placeholder="Buying Price" value={priceBuy} onChange={e => setPriceBuy(e.target.value)} required />
            <input type="number" placeholder="Selling Price" value={priceSell} onChange={e => setPriceSell(e.target.value)} required />
            <input type="number" placeholder="Discount (optional)" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} />
          {imageFile && <img src={URL.createObjectURL(imageFile)} alt="Preview" style={{width:80,marginTop:8,borderRadius:8}} />}
          <button type="submit" disabled={loading}>{loading ? 'Checking In...' : 'Check In'}</button>
        </form>
      )}
      {message && <div className={message.includes('success') ? 'success' : 'error'}>{message}</div>}
      <InventoryTable items={items} />
    </div>
  );
}

export default InventoryPage;
