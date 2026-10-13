import React, { useCallback, useEffect, useState } from 'react';
import InventoryCheckInPage from './InventoryCheckInPage';
import BarcodeGenerationPage from './BarcodeGenerationPage';
import BarcodeScanCheckInPage from './BarcodeScanCheckInPage';
import InventoryList from './InventoryList';

function InventoryPage({ user }) {
  const [step, setStep] = useState('list');
  const [checkInData, setCheckInData] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [items, setItems] = useState([]);
  const isAdmin = ['admin', 'owner'].includes(user.role);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.api.getInventory();
      if (result?.success === false) throw new Error(result.error || 'Could not load inventory.');
      const rows = Array.isArray(result) ? result : result?.items;
      if (!Array.isArray(rows)) throw new Error('Inventory response was not in the expected format.');
      setItems(rows);
    } catch (fetchError) {
      console.error('Inventory fetch failed:', fetchError);
      setError(fetchError.message || 'Could not load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const saveStockBatch = async () => {
    if (!checkInData || barcodes.length === 0) return false;
    setSaving(true);
    setError('');
    try {
      const result = await window.api.addInventoryItems({
        category: checkInData.category,
        subcategory: checkInData.subcategory,
        buyingPrice: checkInData.buyingPrice,
        sellingPrice: checkInData.sellingPrice,
        discount: checkInData.discount,
        barcodes,
        imagePath: checkInData.imagePath,
      });
      if (!result?.success) throw new Error(result?.error || 'Stock intake was not saved.');
      setNotice(`Checked in ${barcodes.length} item${barcodes.length === 1 ? '' : 's'} successfully.`);
      setStep('list');
      setCheckInData(null);
      setBarcodes([]);
      await fetchItems();
      return true;
    } catch (saveError) {
      console.error('Stock intake failed:', saveError);
      setError(saveError.message || 'Stock intake failed.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const cancelIntake = () => {
    setStep('list');
    setCheckInData(null);
    setBarcodes([]);
    setError('');
  };

  const updatePricing = async pricing => {
    const result = await window.api.updateItemPricing(pricing);
    if (!result?.success) throw new Error(result?.error || 'Inventory pricing was not updated.');
    setNotice('Prices updated. The change was added to the audit log.');
    await fetchItems();
  };

  return (
    <section className="inventory-page card page-card">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Stock control</p>
          <h1>Inventory</h1>
          <p className="muted">Welcome, {user.name} ({user.role})</p>
        </div>
        {isAdmin && step === 'list' && <button className="primary-button" type="button" onClick={() => { setNotice(''); setError(''); setStep('checkin'); }}>+ New stock</button>}
      </header>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="success" role="status">{notice}</div>}
      {step === 'list' && <InventoryList items={items} loading={loading} canManage={isAdmin} onUpdatePricing={updatePricing} />}
      {isAdmin && step === 'checkin' && <InventoryCheckInPage onSubmit={data => { setCheckInData(data); setStep('barcode'); }} />}
      {isAdmin && step === 'barcode' && checkInData && <BarcodeGenerationPage checkInData={checkInData} onComplete={codes => { setBarcodes(codes); setStep('scan'); }} />}
      {isAdmin && step === 'scan' && barcodes.length > 0 && <BarcodeScanCheckInPage barcodes={barcodes} onComplete={saveStockBatch} saving={saving} />}
      {step !== 'list' && <button type="button" className="secondary-button cancel-intake" onClick={cancelIntake} disabled={saving}>Cancel intake</button>}
    </section>
  );
}

export default InventoryPage;
