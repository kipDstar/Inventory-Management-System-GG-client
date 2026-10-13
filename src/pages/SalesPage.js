import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BarcodeInput from '../components/BarcodeInput';
import placeholderImage from '../assets/placeholder.png';

function isActiveShift(shift) {
  if (!shift) return false;
  if (typeof shift === 'string') return ['in', 'active', 'checked_in'].includes(shift.toLowerCase());
  if (shift.activeShiftId) return true;
  const status = String(shift.status || shift.state || '').toLowerCase();
  if (['out', 'inactive', 'closed', 'checked_out'].includes(status)) return false;
  if (['in', 'active', 'open', 'checked_in'].includes(status)) return true;
  const checkIn = shift.checkIn || shift.check_in;
  const checkOut = shift.checkOut || shift.check_out;
  return Boolean(checkIn && !checkOut);
}

function normalizeRows(result, key) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.[key])) return result[key];
  if (Array.isArray(result?.payments)) return result.payments;
  if (result?.success === false) throw new Error(result.error || 'Request failed.');
  return [];
}

function money(value) {
  return `KES ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function salePrice(item) {
  const price = Number(item.priceSell || 0);
  const discount = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return price * (1 - discount / 100);
}

const FINAL_STK_STATUSES = new Set(['confirmed', 'failed', 'review_required']);
const STK_POLL_INTERVAL_MS = 2500;
const STK_MAX_POLL_ATTEMPTS = 36;

function normalizePaymentStatus(status) {
  return String(status || 'pending').toLowerCase();
}

function paymentRecordToRequest(payment) {
  return {
    paymentId: payment.id ?? payment.paymentId,
    saleId: payment.sale_id ?? payment.saleId,
    status: normalizePaymentStatus(payment.status),
    receipt: payment.receipt_code || payment.receiptCode || payment.receipt || '',
    description: payment.result_description || payment.resultDescription || '',
    amount: Number(payment.amount ?? (payment.amount_cents != null ? payment.amount_cents / 100 : payment.amountCents != null ? payment.amountCents / 100 : 0)),
    createdAt: payment.created_at || payment.createdAt || '',
    phone: payment.phone_number || payment.phoneNumber || '',
    reference: payment.checkout_request_id || payment.checkoutRequestId || '',
  };
}

function SalesPage({ user }) {
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [shift, setShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [mpesaMode, setMpesaMode] = useState('manual');
  const [paymentReference, setPaymentReference] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [scannedBarcodes, setScannedBarcodes] = useState([]);
  const [stkLoading, setStkLoading] = useState(false);
  const [stkRequests, setStkRequests] = useState([]);
  const [stkRestoreLoading, setStkRestoreLoading] = useState(true);
  const [stkRestoreError, setStkRestoreError] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
  const [shiftError, setShiftError] = useState('');
  const stkRequestsRef = useRef([]);
  const cartRef = useRef([]);
  const pollAttemptsRef = useRef(new Map());
  const handledStatusRef = useRef(new Set());
  const pollBusyRef = useRef(false);
  const pollWakeRef = useRef(null);

  useEffect(() => { stkRequestsRef.current = stkRequests; }, [stkRequests]);
  useEffect(() => { cartRef.current = cart; }, [cart]);

  const loadShift = useCallback(async () => {
    setShiftLoading(true);
    setShiftError('');
    try {
      const result = await window.api.getShiftStatus();
      if (result?.success === false) throw new Error(result.error || 'Could not check active shift.');
      setShift(result?.shift ?? result ?? null);
    } catch (error) {
      console.error('Shift status lookup failed:', error);
      setShift(null);
      setShiftError(error.message || 'Could not check active shift.');
    } finally {
      setShiftLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const result = await window.api.getAllItems();
      const rows = normalizeRows(result, 'items');
      setInventory(rows);
    } catch (error) {
      console.error('Sales inventory load failed:', error);
      setMessage(error.message || 'Could not load products.');
      setMessageType('error');
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => { loadShift(); loadInventory(); }, [loadShift, loadInventory]);

  const mergePaymentStatus = useCallback(async (request, payment) => {
    const updated = paymentRecordToRequest(payment);
    if (updated.paymentId == null) return;
    setStkRequests(current => current.map(existing => String(existing.paymentId) === String(updated.paymentId)
      ? { ...existing, ...updated, reference: updated.reference || existing.reference, barcodes: existing.barcodes || request.barcodes, pollExhausted: false, statusError: '' }
      : existing));
    const statusKey = `${updated.paymentId}:${updated.status}`;
    if (!FINAL_STK_STATUSES.has(updated.status) || handledStatusRef.current.has(statusKey)) return;
    handledStatusRef.current.add(statusKey);
    if (updated.status === 'confirmed') {
      const requestCodes = request.barcodes || [];
      const currentCodes = cartRef.current.map(item => item.barcode);
      if (requestCodes.length && requestCodes.length === currentCodes.length && requestCodes.every(code => currentCodes.includes(code))) {
        setCart([]);
        cartRef.current = [];
        setScannedBarcodes([]);
        setCustomerName('');
      }
      if (updated.saleId != null) {
        try {
          const receiptResult = await window.api.getSaleReceipt(updated.saleId);
          if (!receiptResult?.success || !receiptResult.receipt) {
            throw new Error(receiptResult?.error || 'Sale receipt could not be loaded.');
          }
          setLastReceipt(receiptResult.receipt);
        } catch (receiptError) {
          console.error('Confirmed M-Pesa receipt lookup failed:', receiptError);
          setMessage(`Payment confirmed, but the receipt could not be loaded: ${receiptError.message || 'Try again or ask a manager.'}`);
          setMessageType('error');
        }
      }
    }
    await loadInventory();
  }, [loadInventory]);

  const pollPaymentStatus = useCallback(async (request, isCancelled = () => false) => {
    try {
      const result = await window.api.getMpesaPayments({ paymentId: request.paymentId });
      if (isCancelled()) return;
      const rows = normalizeRows(result, 'payments');
      const payment = rows.find(row => String(row.id ?? row.paymentId) === String(request.paymentId)) || rows[0];
      if (payment) await mergePaymentStatus(request, payment);
      else setStkRequests(current => current.map(existing => String(existing.paymentId) === String(request.paymentId)
        ? { ...existing, statusError: 'Payment status was not returned. Check again or ask an administrator to review.' }
        : existing));
    } catch (statusError) {
      if (isCancelled()) return;
      console.error(`M-Pesa payment status lookup failed for ${request.paymentId}:`, statusError);
      setStkRequests(current => current.map(existing => String(existing.paymentId) === String(request.paymentId)
        ? { ...existing, statusError: statusError.message || 'Could not retrieve payment status.' }
        : existing));
    }
  }, [mergePaymentStatus]);

  useEffect(() => {
    let cancelled = false;
    const restorePendingPayments = async () => {
      setStkRestoreLoading(true);
      setStkRestoreError('');
      try {
        if (typeof window.api.getMpesaPayments !== 'function') throw new Error('M-Pesa payment status is unavailable in this desktop build.');
        const result = await window.api.getMpesaPayments();
        const payments = normalizeRows(result, 'payments');
        if (cancelled) return;
        const pending = payments.map(paymentRecordToRequest)
          .filter(payment => payment.paymentId != null && ['pending', 'review_required'].includes(payment.status));
        setStkRequests(current => {
          const byId = new Map(current.map(request => [String(request.paymentId), request]));
          for (const request of pending) {
            const previous = byId.get(String(request.paymentId));
            byId.set(String(request.paymentId), { ...previous, ...request, restored: true, barcodes: previous?.barcodes || [] });
          }
          return [...byId.values()];
        });
        pollWakeRef.current?.();
      } catch (restoreError) {
        console.error('Pending M-Pesa payments could not be restored:', restoreError);
        if (!cancelled) setStkRestoreError(restoreError.message || 'Pending M-Pesa payments could not be restored.');
      } finally {
        if (!cancelled) setStkRestoreLoading(false);
      }
    };
    restorePendingPayments();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout = null;
    const schedulePoll = () => {
      if (!cancelled && timeout === null) timeout = setTimeout(pollPending, STK_POLL_INTERVAL_MS);
    };
    const pollPending = async () => {
      timeout = null;
      if (cancelled || pollBusyRef.current) return;
      const pending = stkRequestsRef.current.filter(request => request.status === 'pending' && !request.pollExhausted);
      if (!pending.length) return;
      pollBusyRef.current = true;
      try {
        for (const request of pending) {
          if (cancelled) break;
          const key = String(request.paymentId);
          const attempts = pollAttemptsRef.current.get(key) || 0;
          if (attempts >= STK_MAX_POLL_ATTEMPTS) {
            setStkRequests(current => current.map(existing => String(existing.paymentId) === key && existing.status === 'pending' ? { ...existing, pollExhausted: true } : existing));
            continue;
          }
          pollAttemptsRef.current.set(key, attempts + 1);
          await pollPaymentStatus(request, () => cancelled);
          if (attempts + 1 >= STK_MAX_POLL_ATTEMPTS) {
            setStkRequests(current => current.map(existing => String(existing.paymentId) === key && existing.status === 'pending' ? { ...existing, pollExhausted: true } : existing));
          }
        }
      } finally {
        pollBusyRef.current = false;
      }
      const hasPollableRequest = stkRequestsRef.current.some(request => (
        request.status === 'pending' && !request.pollExhausted &&
        (pollAttemptsRef.current.get(String(request.paymentId)) || 0) < STK_MAX_POLL_ATTEMPTS
      ));
      if (hasPollableRequest) schedulePoll();
    };
    pollWakeRef.current = schedulePoll;
    schedulePoll();
    return () => {
      cancelled = true;
      if (timeout !== null) clearTimeout(timeout);
      pollWakeRef.current = null;
    };
  }, [pollPaymentStatus]);

  const checkPaymentStatusNow = async request => {
    if (pollBusyRef.current) return;
    const key = String(request.paymentId);
    pollAttemptsRef.current.set(key, 1);
    setStkRequests(current => current.map(existing => String(existing.paymentId) === key ? { ...existing, pollExhausted: false, statusError: '' } : existing));
    pollBusyRef.current = true;
    try {
      await pollPaymentStatus(request);
    } finally {
      pollBusyRef.current = false;
      pollWakeRef.current?.();
    }
  };

  const activeShift = isActiveShift(shift);
  const hasUnresolvedStk = stkRequests.some(request => ['pending', 'review_required'].includes(request.status));
  const filteredInventory = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter(item => [item.category, item.subcategory, item.barcode]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }, [inventory, search]);
  const cartTotal = cart.reduce((sum, item) => sum + salePrice(item), 0);
  const allItemsScanned = cart.length > 0 && cart.every(item => scannedBarcodes.includes(item.barcode));

  const addToCart = item => {
    if (!activeShift) {
      setMessage('Check in to an active shift before starting a sale.');
      setMessageType('error');
      return;
    }
    if (cart.some(cartItem => cartItem.barcode === item.barcode)) return;
    setCart(current => [...current, item]);
    setMessage('');
    setMessageType('');
  };

  const removeFromCart = barcode => {
    setCart(current => current.filter(item => item.barcode !== barcode));
    setScannedBarcodes(current => current.filter(code => code !== barcode));
  };

  const handleBarcodeScan = code => {
    if (!activeShift) {
      setMessage('Check in to an active shift before scanning a sale.');
      setMessageType('error');
      return;
    }
    if (!cart.some(item => item.barcode === code)) {
      setMessage('Barcode is not in this cart. Add its product first.');
      setMessageType('error');
      return;
    }
    if (scannedBarcodes.includes(code)) {
      setMessage('This cart barcode has already been scanned.');
      setMessageType('error');
      return;
    }
    setScannedBarcodes(current => [...current, code]);
    setMessage(`Verified ${code}.`);
    setMessageType('success');
  };

  const requestStk = async () => {
    if (hasUnresolvedStk) {
      setMessage('Resolve the existing pending or review-required M-Pesa payment before requesting another prompt.');
      setMessageType('error');
      return;
    }
    if (!activeShift || cart.length === 0 || !allItemsScanned) {
      setMessage('Check in and scan every cart item before requesting M-Pesa.');
      setMessageType('error');
      return;
    }
    if (!phoneNumber.trim()) {
      setMessage('Enter the customer’s M-Pesa phone number.');
      setMessageType('error');
      return;
    }
    setStkLoading(true);
    setMessage('');
    try {
      const result = await window.api.requestMpesaStk({
        barcodes: cart.map(item => item.barcode),
        phoneNumber: phoneNumber.trim(),
      });
      if (!result?.success) throw new Error(result?.error || 'M-Pesa request could not be started.');
      if (!result.paymentId) throw new Error('M-Pesa prompt was sent without a payment ID. Do not retry until an administrator checks the payment status.');
      const reference = result.checkoutRequestId || result.paymentId;
      const request = { paymentId: result.paymentId, reference, status: 'pending', amount: cartTotal, phone: phoneNumber.trim(), barcodes: cart.map(item => item.barcode), createdAt: new Date().toISOString(), restored: false };
      pollAttemptsRef.current.set(String(request.paymentId), 0);
      handledStatusRef.current.delete(`${request.paymentId}:confirmed`);
      handledStatusRef.current.delete(`${request.paymentId}:failed`);
      handledStatusRef.current.delete(`${request.paymentId}:review_required`);
      setStkRequests(current => [request, ...current.filter(existing => String(existing.paymentId) !== String(request.paymentId))]);
      pollWakeRef.current?.();
      setMessage(`M-Pesa prompt sent for ${money(cartTotal)}. Waiting for payment confirmation.`);
      setMessageType('success');
      await loadInventory();
    } catch (error) {
      console.error('M-Pesa STK request failed:', error);
      setMessage(error.message || 'M-Pesa request failed.');
      setMessageType('error');
    } finally {
      setStkLoading(false);
    }
  };

  const checkout = async event => {
    event.preventDefault();
    if (loading || stkLoading) return;
    if (hasUnresolvedStk) {
      setMessage('An M-Pesa STK payment is still pending or requires review. Wait for its status before recording another checkout.');
      setMessageType('error');
      return;
    }
    if (!cart.length || !allItemsScanned) {
      setMessage('Scan each barcode in the cart before completing the sale.');
      setMessageType('error');
      return;
    }
    if (paymentMethod === 'mpesa' && mpesaMode === 'daraja') {
      setMessage('Daraja STK payments are completed automatically by the payment callback.');
      setMessageType('error');
      return;
    }
    if (paymentMethod === 'mpesa' && !paymentReference.trim()) {
      setMessage('Enter the M-Pesa receipt/reference before completing the sale.');
      setMessageType('error');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const shiftResult = await window.api.getShiftStatus();
      if (shiftResult?.success === false || !isActiveShift(shiftResult?.shift ?? shiftResult)) {
        setShift(shiftResult?.shift ?? null);
        throw new Error('Your shift is no longer active. Check in before recording this sale.');
      }
      const result = await window.api.checkoutSale({
        items: cart.map(item => ({ barcode: item.barcode })),
        paymentMethod,
        paymentReference: paymentMethod === 'mpesa' ? paymentReference.trim() : '',
        customerName: customerName.trim(),
      });
      if (!result?.success) throw new Error(result?.error || 'Sale could not be recorded.');
      setLastReceipt(result);
      setCart([]);
      setScannedBarcodes([]);
      setCustomerName('');
      setPaymentReference('');
      setPhoneNumber('');
      setMessage('Sale recorded successfully.');
      setMessageType('success');
      await loadInventory();
    } catch (error) {
      console.error('Sale checkout failed:', error);
      setMessage(error.message || 'Sale could not be recorded.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="sales-page card page-card">
      <header className="page-heading">
        <div><p className="eyebrow">Point of sale</p><h1>Sales / Checkout</h1><p className="muted">Welcome, {user.name}</p></div>
        <div className={`shift-pill ${activeShift ? 'is-active' : 'is-inactive'}`}>
          {shiftLoading ? 'Checking shift…' : activeShift ? 'Shift active' : 'Shift required'}
        </div>
      </header>
      {shiftError && <div className="error" role="alert">{shiftError} <button type="button" className="text-button" onClick={loadShift}>Retry</button></div>}
      {!shiftLoading && !activeShift && <div className="notice notice-warning">Sales are disabled until you check in on the Shift page.</div>}
      {message && <div className={messageType === 'success' ? 'success' : 'error'} role="status">{message}</div>}
      {lastReceipt && <div className="receipt-ready notice" role="status">
        <span>Sale #{lastReceipt.id} recorded. VAT-inclusive total: {money((lastReceipt.totalAmountCents || 0) / 100)}.</span>
        <button type="button" className="secondary-button" onClick={() => window.print()}>Print receipt</button>
      </div>}
      {stkRestoreError && <div className="error" role="alert">{stkRestoreError} <button type="button" className="text-button" onClick={() => window.api.getMpesaPayments().then(result => { const payments = normalizeRows(result, 'payments'); const pending = payments.map(paymentRecordToRequest).filter(payment => payment.paymentId != null && ['pending', 'review_required'].includes(payment.status)); setStkRequests(current => [...pending.map(request => ({ ...request, restored: true })), ...current.filter(existing => !pending.some(request => String(request.paymentId) === String(existing.paymentId)))]); setStkRestoreError(''); pollWakeRef.current?.(); }).catch(error => { console.error('Pending M-Pesa payment retry failed:', error); setStkRestoreError(error.message || 'Could not restore pending payments.'); })}>Retry</button></div>}
      {stkRestoreLoading && <p className="muted" role="status">Checking for pending M-Pesa requests…</p>}
      {stkRequests.length > 0 && <section className="stk-payment-list panel" aria-label="M-Pesa STK request statuses"><h2>M-Pesa STK payments</h2>{stkRequests.map(request => <article className={`stk-payment-card panel stk-${request.status}`} key={request.paymentId}>
        <div className="stk-payment-heading"><strong>Payment {request.paymentId}</strong><span className={`status-badge ${request.status === 'confirmed' ? 'status-success' : request.status === 'pending' || request.status === 'review_required' ? 'shift-pill is-inactive' : ''}`}>{request.status === 'review_required' ? 'Review required' : request.status}</span></div>
        <p>{request.amount ? money(request.amount) : 'Amount recorded'}{request.phone ? ` · ${request.phone}` : ''}{request.createdAt ? ` · ${new Date(request.createdAt).toLocaleString()}` : ''}</p>
        {request.reference && <p><strong>Checkout reference:</strong> {request.reference}</p>}
        {request.receipt && <p><strong>Receipt:</strong> {request.receipt}</p>}
        {request.description && <p><strong>Result:</strong> {request.description}</p>}
        {request.status === 'pending' && <p className="muted">Waiting for Daraja payment confirmation. Do not charge or submit these items again.</p>}
        {request.status === 'failed' && <p className="error">Payment failed. The cart was kept so you can verify payment or retry with a new prompt.</p>}
        {request.status === 'review_required' && <p className="error">This payment needs administrator review. Do not retry or manually record the sale until it has been resolved.</p>}
        {request.status === 'confirmed' && <p className="success">Payment confirmed. The sale was recorded by Daraja.</p>}
        {request.statusError && <p className="error" role="alert">{request.statusError}</p>}
        {request.status === 'pending' && request.pollExhausted && <button type="button" className="secondary-button" onClick={() => checkPaymentStatusNow(request)}>Check payment status</button>}
      </article>)}</section>}

      <div className="sales-layout">
        <section className="panel">
          <div className="section-heading"><div><h2>Available stock</h2><p className="muted">Choose an item, then verify it with its barcode.</p></div></div>
          <label className="search-label">Search products
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Brand, category, or barcode" />
          </label>
          {inventoryLoading ? <p className="loading-state">Loading inventory…</p> : (
            <div className="table-scroll"><table>
              <thead><tr><th>Product</th><th>Barcode</th><th>Price</th><th></th></tr></thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.barcode}>
                    <td className="product-cell"><img src={item.imagePath || item.image_path || placeholderImage} alt="" /><span>{item.category} · {item.subcategory}{item.requiresPricingReview && <small className="error">Price review required — unavailable for sale</small>}</span></td>
                    <td>{item.barcode}</td>
                    <td>{money(salePrice(item))}{Number(item.discount) > 0 && <small className="discount-note">{item.discount}% off</small>}</td>
                    <td><button type="button" className="small-button" disabled={!activeShift || hasUnresolvedStk || item.requiresPricingReview || cart.some(row => row.barcode === item.barcode)} onClick={() => addToCart(item)}>{item.requiresPricingReview ? 'Price needed' : cart.some(row => row.barcode === item.barcode) ? 'Added' : 'Add'}</button></td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && <tr><td colSpan="4" className="empty-cell">{inventory.length ? 'No matching products.' : 'No stock available.'}</td></tr>}
              </tbody>
            </table></div>
          )}
        </section>

        <section className="panel cart-panel">
          <div className="section-heading"><div><h2>Current sale</h2><p className="muted">{cart.length} item{cart.length === 1 ? '' : 's'}</p></div></div>
          {cart.length === 0 ? <p className="empty-state">Add products from inventory to start a sale.</p> : (
            <div className="table-scroll"><table>
              <thead><tr><th>Product</th><th>Barcode</th><th>Price</th><th>Scanned</th><th></th></tr></thead>
              <tbody>{cart.map(item => <tr key={item.barcode}>
                <td>{item.category} · {item.subcategory}</td><td>{item.barcode}</td><td>{money(salePrice(item))}</td>
                <td>{scannedBarcodes.includes(item.barcode) ? <span className="status-badge status-success">Verified</span> : <span className="status-badge">Pending</span>}</td>
                <td><button type="button" className="text-button danger-text" onClick={() => removeFromCart(item.barcode)} disabled={hasUnresolvedStk}>Remove</button></td>
              </tr>)}</tbody>
            </table></div>
          )}
          <div className="sale-total"><span>Total</span><strong>{money(cartTotal)}</strong></div>
          <BarcodeInput onScan={handleBarcodeScan} disabled={!activeShift || cart.length === 0 || allItemsScanned} label="Verify a cart item barcode" />

          <form className="sale-payment-form" onSubmit={checkout}>
            <label>Customer name (optional)
              <input type="text" value={customerName} onChange={event => setCustomerName(event.target.value)} autoComplete="name" />
            </label>
            <label>Payment method
              <select value={paymentMethod} onChange={event => { setPaymentMethod(event.target.value); setPaymentReference(''); }}>
                <option value="cash">Cash</option><option value="mpesa">M-Pesa</option>
              </select>
            </label>
            {paymentMethod === 'mpesa' && <>
              <label>M-Pesa payment type
                <select value={mpesaMode} onChange={event => { setMpesaMode(event.target.value); setPaymentReference(''); }}>
                  <option value="manual">Enter receipt/reference</option><option value="daraja">Request Daraja STK prompt</option>
                </select>
              </label>
              {mpesaMode === 'manual' ? (
                <label>M-Pesa receipt/reference
                  <input type="text" value={paymentReference} onChange={event => setPaymentReference(event.target.value)} placeholder="e.g. QAB12XYZ" required={paymentMethod === 'mpesa'} />
                </label>
              ) : <>
                <label>Customer phone number
                  <input type="tel" inputMode="tel" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="e.g. 2547XXXXXXXX" />
                </label>
                <button type="button" className="secondary-button" onClick={requestStk} disabled={stkLoading || !allItemsScanned || !activeShift || hasUnresolvedStk}>{stkLoading ? 'Requesting prompt…' : hasUnresolvedStk ? 'Resolve pending payment first' : 'Request M-Pesa prompt'}</button>
                <p className="muted">After the customer accepts the prompt, Daraja confirms the payment and the backend records the sale.</p>
              </>}
            </>}
            {!(paymentMethod === 'mpesa' && mpesaMode === 'daraja') && <button className="primary-button checkout-button" type="submit" disabled={loading || stkLoading || !activeShift || hasUnresolvedStk || !allItemsScanned || (paymentMethod === 'mpesa' && !paymentReference.trim())}>
              {loading ? 'Recording sale…' : `Complete sale · ${money(cartTotal)}`}
            </button>}
          </form>
        </section>
      </div>
      {lastReceipt && <article className="receipt-print-area" aria-label={`Receipt for sale ${lastReceipt.id}`}>
        <header className="receipt-header">
          <h1>{lastReceipt.business?.name || 'GG Liquor Shop'}</h1>
          {lastReceipt.business?.kraPin && <p>KRA PIN: {lastReceipt.business.kraPin}</p>}
          <p>VAT-inclusive sales receipt</p>
          <p>Not a KRA eTIMS tax invoice</p>
        </header>
        <div className="receipt-meta">
          <p>Receipt: #{lastReceipt.id}</p>
          <p>{lastReceipt.createdAt ? new Date(lastReceipt.createdAt).toLocaleString() : ''}</p>
          <p>Served by: {lastReceipt.userName || user.name}</p>
          {lastReceipt.customerName && <p>Customer: {lastReceipt.customerName}</p>}
          <p>Payment: {lastReceipt.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}</p>
          {lastReceipt.paymentReference && <p>M-Pesa receipt: {lastReceipt.paymentReference}</p>}
        </div>
        <table className="receipt-lines">
          <thead><tr><th>Item</th><th>Amount</th></tr></thead>
          <tbody>{(lastReceipt.lines || lastReceipt.items || []).map((line, index) => (
            <tr key={`${line.barcode || 'item'}-${index}`}>
              <td>{line.subcategory || 'Item'}<small>{line.barcode || ''}</small></td>
              <td>{money((line.lineTotalCents || 0) / 100)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="receipt-totals">
          <p><span>Taxable amount (net)</span><strong>{money((lastReceipt.taxableAmountCents || 0) / 100)}</strong></p>
          <p><span>VAT included ({((lastReceipt.taxRateBasisPoints || 1600) / 100).toFixed(0)}%)</span><strong>{money((lastReceipt.taxTotalCents || 0) / 100)}</strong></p>
          <p className="receipt-grand-total"><span>Total paid</span><strong>{money((lastReceipt.totalAmountCents || 0) / 100)}</strong></p>
        </div>
        <footer className="receipt-footer"><p>Thank you for shopping with us.</p><p>Prices shown include VAT at the standard rate.</p></footer>
      </article>}
    </section>
  );
}

export default SalesPage;
