// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  checkIn: (item) => ipcRenderer.invoke('check-in', item),
  getAllItems: () => ipcRenderer.invoke('get-all-items'),
  getItemByBarcode: (barcode) => ipcRenderer.invoke('get-item-by-barcode', barcode),
  checkoutSale: (sale) => ipcRenderer.invoke('checkout-sale', sale),
  getAllStaff: () => ipcRenderer.invoke('get-all-staff'),
  addStaff: (staff) => ipcRenderer.invoke('add-staff', staff),
  shiftCheckIn: (userId) => ipcRenderer.invoke('shift-check-in', userId),
  shiftCheckOut: (userId) => ipcRenderer.invoke('shift-check-out', userId),
  getSales: (filters) => ipcRenderer.invoke('get-sales', filters),
  generateSalesReportPDF: (sales, password) => ipcRenderer.invoke('generate-sales-report-pdf', { sales, password }),
  emailSalesReport: (sales, email, password) => ipcRenderer.invoke('email-sales-report', { sales, email, password }),
  saveItemImage: (filename, dataUrl) => ipcRenderer.invoke('save-item-image', filename, dataUrl),
  getInventory: () => ipcRenderer.invoke('getInventory'),
  addInventoryItems: (data) => ipcRenderer.invoke('addInventoryItems', data),
});
