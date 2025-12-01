# Screenshots Needed for v1.1.0 Features

To complete the documentation, capture these screenshots:

## Required Screenshots

### 1. agent-my-sales.png
- **Portal:** Agent Frontend (port 3002)
- **Navigation:** Login as agent → Click "My Sales" tab
- **Content:** Shows sales stats (total count, total value) and list of sold properties

### 2. admin-sales-report.png
- **Portal:** Admin Frontend (port 3003)
- **Navigation:** Login as admin → Click "Sales Report" tab
- **Content:** Shows filters (agent dropdown, date range), sales table, CSV export button

### 3. customer-sold-badge.png
- **Portal:** Customer Frontend (port 3001)
- **Navigation:** Browse properties page with a sold property
- **Content:** Property card showing SOLD or RENTED ribbon badge overlay

## How to Capture

1. Start the backend: `cd backend && npm start`
2. Start the frontend you need
3. Mark a property as sold (agent/admin portal)
4. Navigate to the relevant page
5. Take screenshot and save with the exact filename above
