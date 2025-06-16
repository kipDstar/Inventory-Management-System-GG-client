import React, { useEffect, useState } from 'react';

export default function InventoryList({ items = [], loading }) {
  const [search, setSearch] = useState('');

  const filtered = items.filter(
    item =>
      (item.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.subcategory || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.barcode || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h2>Inventory</h2>
      <input
        type="text"
        placeholder="Search by category, brand, or barcode"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 16, padding: 8, borderRadius: 8, width: 300 }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.9)', borderRadius: 12 }}>
        <thead>
          <tr>
            <th>Image</th>
            <th>Category</th>
            <th>Brand</th>
            <th>Barcode</th>
            <th>Stock Status</th>
            <th>Selling Price</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(item => (
            <tr key={item.barcode}>
              <td>
                {item.image_path ? (
                  <img src={item.image_path} alt={item.subcategory} style={{ width: 48, height: 48, borderRadius: 8 }} />
                ) : (
                  <span style={{ color: '#aaa' }}>No Image</span>
                )}
              </td>
              <td>{item.category}</td>
              <td>{item.subcategory}</td>
              <td>{item.barcode}</td>
              <td>{item.status}</td>
              <td>{item.selling_price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}