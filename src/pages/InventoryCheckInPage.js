import React, { useState } from 'react';
import './InventoryCheckInPage.css';

const categories = {
  Beer: ['Tusker (500ml)', 'Tusker Lite (500ml)', 'Balozi (500ml)', 'White Cap (500ml)', 'Pilsner (500ml)', 'Guinness (500ml)'],
  Wine: ['Four Cousins', 'Cellar Cask', 'Robertson', 'Overmeer'],
  Soda: ['Coca Cola', 'Fanta', 'Sprite', 'Krest', 'Stoney'],
  Water: ['Keringet', 'Dasani', 'Aquamist', 'Highlands'],
  Liquor: ['Johnnie Walker Red', 'Johnnie Walker Black', 'Jameson', 'Captain Morgan', 'Smirnoff Vodka'],
  Mixers: ['Schweppes Tonic', 'Schweppes Soda', 'Red Bull', 'Monster'],
};

export default function InventoryCheckInPage({ onSubmit }) {
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [image, setImage] = useState(null);
  const [imagePath, setImagePath] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async event => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedBuyingPrice = Number(buyingPrice);
    const parsedSellingPrice = Number(sellingPrice);
    const parsedDiscount = Number(discount || 0);
    if (!category || !subcategory || !Number.isInteger(parsedQuantity) || parsedQuantity < 1 ||
      !Number.isFinite(parsedBuyingPrice) || parsedBuyingPrice < 0 ||
      !Number.isFinite(parsedSellingPrice) || parsedSellingPrice < 0 ||
      !Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
      setError('Enter a category, brand, positive whole quantity, and valid prices/discount.');
      return;
    }
    setError('');
    setSaving(true);
    let savedImagePath = imagePath.trim();
    try {
      if (!savedImagePath && image) {
        if (typeof window.api?.saveItemImage !== 'function') throw new Error('Image upload is unavailable in this desktop session. Enter an image path instead.');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error || new Error('The selected image could not be read.'));
          reader.readAsDataURL(image);
        });
        const result = await window.api.saveItemImage(image.name, dataUrl);
        if (!result?.success || !result.path) throw new Error(result?.error || 'The selected image could not be saved.');
        savedImagePath = result.path;
      }
    } catch (imageError) {
      console.error('Inventory image save failed:', imageError);
      setError(imageError.message || 'The selected image could not be saved.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onSubmit({
      category,
      subcategory,
      quantity: parsedQuantity,
      buyingPrice: parsedBuyingPrice,
      sellingPrice: parsedSellingPrice,
      discount: parsedDiscount,
      imagePath: savedImagePath || image?.path || '',
    });
  };

  return (
    <div className="checkin-glass-card">
      <h2>Inventory Check-In</h2>
      <form className="checkin-form" onSubmit={handleSubmit}>
        <label>Category
          <select value={category} onChange={event => { setCategory(event.target.value); setSubcategory(''); }} required>
            <option value="">Select category…</option>
            {Object.keys(categories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
        <label>Subcategory / Brand
          <select value={subcategory} onChange={event => setSubcategory(event.target.value)} disabled={!category} required>
            <option value="">Select brand…</option>
            {category && categories[category].map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </label>
        <label>Quantity
          <input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} required />
        </label>
        <label>Buying Price (KES)
          <input type="number" min="0" step="0.01" value={buyingPrice} onChange={event => setBuyingPrice(event.target.value)} required />
        </label>
        <label>Selling Price (KES)
          <input type="number" min="0" step="0.01" value={sellingPrice} onChange={event => setSellingPrice(event.target.value)} required />
        </label>
        <label>Discount (%)
          <input type="number" min="0" max="100" step="0.01" value={discount} onChange={event => setDiscount(event.target.value)} />
        </label>
        <label>Product image path (optional)
          <input type="text" value={imagePath} onChange={event => setImagePath(event.target.value)} placeholder="Local image path" />
          <input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" aria-label="Choose product image" onChange={event => { setImage(event.target.files?.[0] || null); setImagePath(''); }} />
          <small>Selected images are saved with the stock record; you can also enter a local image path.</small>
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" className="animated-btn" disabled={saving}>{saving ? 'Saving image…' : 'Generate Barcodes'}</button>
      </form>
    </div>
  );
}
