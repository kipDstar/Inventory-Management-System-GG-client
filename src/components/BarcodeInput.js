import React, { useEffect, useRef, useState } from 'react';

export default function BarcodeInput({ onScan, disabled = false, label = 'Scan or enter barcode', buttonLabel = 'Submit barcode' }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const submit = async (event) => {
    event?.preventDefault();
    const code = value.trim();
    if (!code || disabled || submittingRef.current) return;

    submittingRef.current = true;
    setError('');
    try {
      await onScan(code);
      setValue('');
    } catch (submitError) {
      console.error('Barcode submission failed:', submitError);
      setError(submitError?.message || 'Could not submit this barcode. Try again.');
    } finally {
      submittingRef.current = false;
      if (!disabled) inputRef.current?.focus();
    }
  };

  return (
    <form className="barcode-entry" onSubmit={submit}>
      <label htmlFor="barcode-entry-input">{label}</label>
      <div className="barcode-entry-row">
        <input
          id="barcode-entry-input"
          ref={inputRef}
          type="text"
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit(event);
            }
          }}
          placeholder="Scan with a USB scanner or type the barcode"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !value.trim()}>{buttonLabel}</button>
      </div>
      <small>Scanner input and manual entry use the same field. Press Enter after scanning or typing.</small>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}
