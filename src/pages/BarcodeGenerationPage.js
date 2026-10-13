import React, { useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { useReactToPrint } from 'react-to-print';

function generateBarcodes({ category, subcategory, quantity }, batchId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return Array.from({ length: Number(quantity) }, (_, i) => (
    `${category.toUpperCase().replace(/\s/g, '')}-${subcategory.toUpperCase().replace(/\s/g, '')}-${date}-${batchId}-${String(i + 1).padStart(4, '0')}`
  ));
}

export default function BarcodeGenerationPage({ checkInData, onComplete }) {
  const { category, subcategory, quantity } = checkInData;
  const batchId = useRef(Math.random().toString(36).slice(2, 8).toUpperCase());
  const barcodes = generateBarcodes({ category, subcategory, quantity }, batchId.current);
  const printRef = useRef(null);
  const svgRefs = useRef([]);

  useEffect(() => {
    barcodes.forEach((code, idx) => {
      if (svgRefs.current[idx]) {
        JsBarcode(svgRefs.current[idx], code, { format: 'CODE128', width: 2, height: 40, displayValue: true });
      }
    });
  }, [category, subcategory, quantity, batchId]);

  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: 'Barcodes' });

  return (
    <section className="barcode-gen-card">
      <h2>Generated Barcodes</h2>
      <p>Print one unique label for every item in this batch, then scan each label to confirm stock intake.</p>
      <div className="barcode-label-grid" ref={printRef}>
        {barcodes.map((code, idx) => (
          <div className="barcode-label" key={code}>
            <svg ref={element => { svgRefs.current[idx] = element; }} />
            <div>{code}</div>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button className="animated-btn" type="button" onClick={handlePrint}>Print Barcodes</button>
        <button className="animated-btn" type="button" onClick={() => onComplete(barcodes)}>Continue to scanning</button>
      </div>
    </section>
  );
}
