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
  const [quantity, setQuantity] = useState(1);
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [image, setImage] = useState(null);

  const handleImageChange = e => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!category || !subcategory || !quantity || !buyingPrice || !sellingPrice) return;
    onSubmit({
      category,
      subcategory,
      quantity,
      buyingPrice,
      sellingPrice,
      discount,
      image,
    });
  };

  return (
    <div className="checkin-glass-card">
      <h2>Inventory Check-In</h2>
      <form className="checkin-form" onSubmit={handleSubmit}>
        <label>
          Category
          <select value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }}>
            <option value="">Select...</option>
            {Object.keys(categories).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>
        <label>
          Subcategory/Brand
          <select value={subcategory} onChange={e => setSubcategory(e.target.value)} disabled={!category}>
            <option value="">Select...</option>
            {category && categories[category].map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
        </label>
        <label>
          Buying Price
          <input type="number" min="0" value={buyingPrice} onChange={e => setBuyingPrice(e.target.value)} />
        </label>
        <label>
          Selling Price
          <input type="number" min="0" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
        </label>
        <label>
          Discount (%)
          <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(e.target.value)} />
        </label>
        <label>
          Product Image
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </label>
        <button type="submit" className="animated-btn">Generate Barcodes</button>
      </form>
    </div>
  );
}