# GG Liquor Shop POS & Inventory Management System

## Project Overview
A desktop Point of Sale and Inventory Management System for GG Liquor Shop, Kenya, built with Electron, React, and SQLite. Supports barcode-based inventory, sales, reporting, and offline-first operation.

---

## Prerequisites
- **OS:** Linux (recommended), Windows, or Mac
- **Node.js:** v18 or newer
- **npm:** v9 or newer
- **Git:** for version control
- **USB Barcode Scanner:** (acts as keyboard input)

---

## Project Structure
```
/ (root)
  forge.config.js
  package.json
  webpack.main.config.js
  webpack.renderer.config.js
  webpack.rules.js
  /src
    index.html
    index.css
    main.js         # Electron main process
    preload.js      # Electron preload script
    renderer.js     # React entry point
    /components     # React UI components
    /db             # Database logic (SQLite)
    /models         # Data models
    /pages          # Page-level React components
    /utils          # Utility functions (PDF, email, charts)
```

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repo-url>
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
