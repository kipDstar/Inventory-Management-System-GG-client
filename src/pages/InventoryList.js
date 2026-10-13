import React, { useMemo, useState } from 'react';
import placeholderImage from '../assets/placeholder.png';

export default function InventoryList({ items = [], loading = false, canManage = false, onUpdatePricing }) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ buyingPrice: '', sellingPrice: '', discount: '0' });
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(item => [item.category, item.subcategory, item.barcode]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }, [items, search]);

  const startEditing = item => {
    setError('');
    setEditingId(item.id);
    setDraft({
      buyingPrice: Number(item.priceBuy ?? item.buyingPrice ?? 0).toFixed(2),
      sellingPrice: Number(item.priceSell ?? item.sellingPrice ?? 0).toFixed(2),
      discount: String(Number(item.discount || 0)),
    });
  };

  const savePricing = async (event, item) => {
    event.preventDefault();
    setSavingId(item.id);
    setError('');
    try {
      await onUpdatePricing({
        itemId: item.id,
        buyingPrice: Number(draft.buyingPrice),
        sellingPrice: Number(draft.sellingPrice),
        discount: Number(draft.discount),
      });
      setEditingId(null);
    } catch (saveError) {
      console.error('Inventory price update failed:', saveError);
      setError(saveError.message || 'Could not update item pricing.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="inventory-list">
      <div className="section-heading"><div><h2>Available stock</h2><p className="muted">Search by category, brand, or barcode.</p></div><span className="count-badge">{items.length} items</span></div>
      <label className="search-label">Search inventory<input type="search" placeholder="Category, brand, or barcode" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {error && <div className="error" role="alert">{error}</div>}
      {loading ? <p className="loading-state">Loading inventory…</p> : <div className="table-scroll"><table>
        <thead><tr><th>Image</th><th>Category</th><th>Brand</th><th>Barcode</th><th>Status</th><th>Selling price</th>{canManage && <th>Pricing action</th>}</tr></thead>
        <tbody>{filtered.map(item => <tr key={item.barcode || item.id}>
          <td><img className="inventory-thumb" src={item.imagePath || item.image_path || placeholderImage} alt={item.subcategory || 'Product'} /></td>
          <td>{item.category || '—'}</td><td>{item.subcategory || '—'}</td><td>{item.barcode || '—'}</td>
          <td>{item.requiresPricingReview
            ? <span className="status-badge status-warning">Price review required</span>
            : <span className="status-badge status-success">{item.status || 'in stock'}</span>}</td>
          <td>KES {Number(item.priceSell || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          {canManage && <td><button type="button" className="small-button" onClick={() => startEditing(item)} disabled={savingId === item.id}>Edit prices</button></td>}
        </tr>)}{filtered.map(item => editingId === item.id && canManage && <tr key={`pricing-${item.id}`}>
          <td colSpan={canManage ? 7 : 6}><form className="inventory-pricing-form" onSubmit={event => savePricing(event, item)}>
            <strong>{item.subcategory || item.barcode} · price review</strong>
            <label>Buying cost<input type="number" min="0.01" step="0.01" required value={draft.buyingPrice} onChange={event => setDraft(current => ({ ...current, buyingPrice: event.target.value }))} /></label>
            <label>Selling price (VAT-inclusive)<input type="number" min="0.01" step="0.01" required value={draft.sellingPrice} onChange={event => setDraft(current => ({ ...current, sellingPrice: event.target.value }))} /></label>
            <label>Discount %<input type="number" min="0" max="100" step="0.01" value={draft.discount} onChange={event => setDraft(current => ({ ...current, discount: event.target.value }))} /></label>
            <button type="submit" className="primary-button" disabled={savingId === item.id}>{savingId === item.id ? 'Saving…' : 'Save prices'}</button>
            <button type="button" className="secondary-button" onClick={() => setEditingId(null)} disabled={savingId === item.id}>Cancel</button>
          </form></td>
        </tr>)}{!filtered.length && <tr><td colSpan={canManage ? 7 : 6} className="empty-cell">{items.length ? 'No matching items.' : 'No inventory records.'}</td></tr>}</tbody>
      </table></div>}
    </section>
  );
}
