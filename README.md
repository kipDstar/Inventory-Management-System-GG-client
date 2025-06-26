# GG Liquor Shop POS & Inventory Management System

![Project Screenshot](https://via.placeholder.com/800x450.png?text=GG+Liquor+Shop+POS+UI)

## Project Overview

A robust, offline-first desktop Point of Sale (POS) and Inventory Management System designed specifically for **GG Liquor Shop, Kenya**. Built with modern web technologies, this application provides a seamless and efficient way to manage sales, track inventory, and generate insightful reports, all from a local desktop environment.

The system is designed to be fast, reliable, and easy to use, leveraging barcode scanning for quick product lookup and sales processing.

---

## Key Features

- **Barcode-Based System:** Fast and accurate product lookup and sales processing using a standard USB barcode scanner.
- **Point of Sale (POS):** Intuitive interface for processing customer sales, calculating totals, and managing transactions.
- **Inventory Management:** Real-time tracking of stock levels, easy product additions, and updates.
- **Sales Reporting:** Generate detailed daily, weekly, and monthly sales reports to track performance.
- **Offline-First:** Core POS and inventory functionalities work without an internet connection, ensuring business continuity. Data is stored locally in a SQLite database.
- **Data Export:** Export reports to PDF for printing or sharing.
- **User Roles & Permissions:** (Planned) Secure access with different permission levels for staff and administrators.

---

## Technology Stack

- **Framework:** [Electron](https://www.electronjs.org/)
- **Frontend:** [React](https://reactjs.org/)
- **Database:** [SQLite](https://www.sqlite.org/index.html)
- **Bundler:** [Webpack](https://webpack.js.org/)
- **Packaging:** [Electron Forge](https://www.electronforge.io/)

---

## Prerequisites

- **OS:** Linux (recommended), Windows, or Mac
- **Node.js:** v18 or newer
- **npm:** v9 or newer
- **Git:** for version control
- **USB Barcode Scanner:** (acts as keyboard input)

---

## Project Structure Explained

```
/ (root)
  ├── forge.config.js             # Configuration for Electron Forge (packaging)
  ├── package.json                # Project dependencies and scripts
  ├── webpack.main.config.js      # Webpack config for the Electron main process
  ├── webpack.renderer.config.js  # Webpack config for the React renderer process
  ├── webpack.rules.js            # Shared Webpack rules
  └── src
      ├── index.html              # HTML template for the application
      ├── index.css               # Global styles
      ├── main.js                 # Electron main process entry point (manages windows, system events)
      ├── preload.js              # Bridges main and renderer processes, exposes Node.js APIs securely
      ├── renderer.js             # React application entry point
      ├── components/             # Reusable React UI components (e.g., Button, Input)
      ├── db/                     # Database logic (SQLite schema, queries, connection)
      ├── models/                 # Data models/schemas for the application
      ├── pages/                  # Page-level React components (e.g., SalesPage, InventoryPage)
      └── utils/                  # Utility functions (e.g., PDF generation, email helpers)
```

---

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Inventory-Management-System.git
cd Inventory-Management-System
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start in Development Mode
```bash
npm start
```

### 4. Build for Production
```bash
npm run build
npm run make
```
- Distributable files will be in the `out/` or `dist/` folder.

---

## Development Workflow
- Edit code in `/src` (React components, Electron logic, DB helpers)
- Hot reload is enabled for renderer (React)
- Use the USB barcode scanner as a keyboard input for barcode fields

---

## Production Deployment
- Run the packaged app on any Linux desktop (or Windows/Mac if built for those platforms)
- No internet required for core functionality
- Reports can be emailed when online

---

## Next Steps
- Implement initial data models and database setup
- Scaffold basic React pages (Login, Inventory, Sales, Reports, Admin Dashboard)
- Add authentication and role-based access
- Integrate barcode input fields

---

## Contact
For support, contact the developer or refer to this README.
