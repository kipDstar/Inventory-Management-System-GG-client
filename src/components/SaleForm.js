// src/components/SaleForm.js
// Sale form for entering sale details

import React from 'react';

function SaleForm({ saleInfo, onChange, onSell }) {
  // TODO: Render sale form fields and sell button
  return (
    <form className="sale-form" onSubmit={onSell}>
      {/* Render sale fields: salesperson, shift, category, subcategory, quantity, payment method */}
      <button type="submit">Sell</button>
    </form>
  );
}

export default SaleForm;
