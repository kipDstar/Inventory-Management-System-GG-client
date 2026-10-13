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
- **Receipts:** Print a VAT-inclusive transaction receipt to a locally installed receipt printer.
- **User Roles & Permissions:** Password-protected staff and administrator access with shift-based sales.

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
- **Node.js:** v22.13.0 or newer (the `.nvmrc` file selects Node 22)
- **npm:** v10 or newer
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
nvm install
nvm use
npm ci
```

### 3. Start in Development Mode
```bash
npm start
```

### 4. Build for Production
```bash
npm run package
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
- Filtered sales reports can be exported to CSV

### First-time setup and access

- Create the first administrator in the app on first launch. Choose a unique password of at least 12 characters.
- Each sales account must check in before making a sale. Check-out closes that session; new sales are rejected until the next check-in.
- Sales, stock movements, and audit events are recorded as append-only financial/operational records. M-Pesa receipts entered manually are marked as manual confirmations, not Daraja-verified payments.
- Packaged app data is stored in Electron's per-user application data directory. The development database in `data/` is intentionally excluded from release packages.
- On the first launch with the clean-dataset migration, the app preserves user accounts, product categories and subcategories, and in-stock items. It removes old sales, closed shifts, audit history, stock movement history, and non-stock items from the active database. A consistent `.pre-clean-<timestamp>.db` archive is created beside the database first; retain and back it up in case historical records are needed. Pending/review-required Daraja requests stop the migration and require reconciliation.
- Preserved stock with missing buying or selling prices remains visible but cannot be sold until an administrator/owner records and audits its prices. Review these rows before opening the shop.

### VAT and receipt setup

Set `IMS_BUSINESS_NAME` and `IMS_KRA_PIN` in the desktop application's launch environment to show the registered seller name and PIN on receipts. Current checkout prices are treated as VAT-inclusive and standard-rated at 16%; the receipt shows the taxable value, included VAT component, and total paid. The calculated VAT component is part of—not added on top of—the displayed selling price.

Receipt output is a POS sales receipt, **not** a KRA eTIMS tax invoice. Do not use it to claim eTIMS compliance: an eTIMS integration, certified invoicing workflow, tax/accounting review, and the applicable seller/product tax configuration must be completed separately before representing printed documents as tax invoices. Confirm current rates, product treatment, and the business PIN with the shop's tax adviser/KRA before customer deployment.

### USB barcode scanners and receipt printers

- Typical USB barcode scanners work in keyboard-wedge/HID mode: they type the scanned code into the focused barcode field and send Enter. Test the exact scanner, suffix configuration, barcode symbologies, and product labels at the checkout counter. No special scanner driver is required for a standard HID scanner.
- Install and configure the target receipt printer in the operating system first. Use the checkout's **Print receipt** action to select/test the printer and 80 mm paper layout. Printer names, supported widths, cutter/drawer support, and silent printing vary by OS and hardware; validate the intended model before deployment. Silent auto-printing is intentionally not enabled.
- Build and test a distributable on the same OS/architecture as the customer machine. Before rollout, test backup/restore, printer paper-out behavior, scanner disconnect/reconnect, and a complete cash/manual-M-Pesa/STK test flow. Sign installers where the target OS requires signing.

### Daraja sandbox STK Push

STK Push is optional and defaults to Safaricom's sandbox. Configure secrets only in the environment used to launch the app; never commit them or put them in renderer code:

```bash
export MPESA_ENVIRONMENT=sandbox
export MPESA_CONSUMER_KEY="your-sandbox-consumer-key"
export MPESA_CONSUMER_SECRET="your-sandbox-consumer-secret"
export MPESA_SHORTCODE="your-sandbox-shortcode"
export MPESA_PASSKEY="your-sandbox-passkey"
export MPESA_CALLBACK_URL="https://your-public-host/mpesa/callback"
export MPESA_CALLBACK_PORT=47851
npm start
```

The callback URL must use HTTPS and forward `/mpesa/callback` to the app's loopback listener on port `47851` (or the configured `MPESA_CALLBACK_PORT`). Do not expose that listener directly to the internet. Daraja sandbox callbacks and sandbox credentials do not verify live payments; production Daraja access, business configuration, callback hosting, backups, and operational reconciliation must be completed and tested before accepting real payments.

---

## Before customer rollout

- Configure the registered business identity and confirm all tax handling with the business's adviser/KRA.
- Complete KRA eTIMS integration if statutory tax invoices are required.
- Validate the exact counter hardware, print format, operator training, and end-of-day reconciliation.
- Configure automated, encrypted backups and rehearse restoration before entering live transactions.
- Complete Safaricom production onboarding and callback hosting before enabling live STK Push.

---

## Contact
For support, contact the developer or refer to this README.
