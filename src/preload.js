// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSetupStatus: () => ipcRenderer.invoke('get-setup-status'),
  createInitialAdmin: (input) => ipcRenderer.invoke('create-initial-admin', input),
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  logout: () => ipcRenderer.invoke('logout'),
  changePassword: (input) => ipcRenderer.invoke('change-password', input),
  checkIn: (item) => ipcRenderer.invoke('check-in', item),
  getAllItems: () => ipcRenderer.invoke('get-all-items'),
  getItemByBarcode: (barcode) => ipcRenderer.invoke('get-item-by-barcode', barcode),
  checkoutSale: (sale) => ipcRenderer.invoke('checkout-sale', sale),
  getSaleReceipt: (saleId) => ipcRenderer.invoke('get-sale-receipt', saleId),
  getAllStaff: () => ipcRenderer.invoke('get-all-staff'),
  addStaff: (staff) => ipcRenderer.invoke('add-staff', staff),
  shiftCheckIn: () => ipcRenderer.invoke('shift-check-in'),
  shiftCheckOut: () => ipcRenderer.invoke('shift-check-out'),
  getShiftStatus: () => ipcRenderer.invoke('get-shift-status'),
  getDashboard: () => ipcRenderer.invoke('get-dashboard'),
  requestMpesaStk: (request) => ipcRenderer.invoke('request-mpesa-stk', request),
  getMpesaPayments: (filters) => ipcRenderer.invoke('get-mpesa-payments', filters),
  getSales: (filters) => ipcRenderer.invoke('get-sales', filters),
  saveItemImage: (filename, dataUrl) => ipcRenderer.invoke('save-item-image', filename, dataUrl),
  getInventory: () => ipcRenderer.invoke('getInventory'),
  addInventoryItems: (data) => ipcRenderer.invoke('addInventoryItems', data),
  updateItemPricing: (input) => ipcRenderer.invoke('update-item-pricing', input),
});
