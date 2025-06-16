import React, { useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { useReactToPrint } from 'react-to-print';

function generateBarcodes({ category, subcategory, quantity }) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return Array.from({ length: Number(quantity) }, (_, i) => (
    `${category.toUpperCase().replace(/\s/g, '')}-${subcategory.toUpperCase().replace(/\s/g, '')}-${date}-${String(i + 1).padStart(4, '0')}`
  ));
}

export default function BarcodeGenerationPage({ checkInData, onComplete }) {
  const { category, subcategory, quantity } = checkInData;
  const barcodes = generateBarcodes({ category, subcategory, quantity });
  const printRef = useRef();
  const svgRefs = useRef([]);

  useEffect(() => {
    barcodes.forEach((code, idx) => {
      if (svgRefs.current[idx]) {
        JsBarcode(svgRefs.current[idx], code, { format: 'CODE128', width: 2, height: 40, displayValue: true });
      }
    });
  }, [barcodes]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Barcodes'
  });

  return (
    <div className="barcode-gen-card">
      <h2>Generated Barcodes</h2>
      <div ref={printRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 24, margin: '1.5rem 0' }}>
        {barcodes.map((code, idx) => (
          <div key={code} style={{ padding: 8, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', textAlign: 'center' }}>
            <svg ref={el => (svgRefs.current[idx] = el)} />
            <div style={{ fontSize: 12, marginTop: 4 }}>{code}</div>
          </div>
        ))}
      </div>
      <button className="animated-btn" onClick={handlePrint}>Print Barcodes</button>
      <button className="animated-btn" style={{ marginLeft: 16 }} onClick={() => onComplete(barcodes)}>Done</button>
    </div>
  );
}