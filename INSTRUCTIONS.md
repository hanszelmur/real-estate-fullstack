# INSTRUCTIONS.md - Real Estate Fullstack Application

This document provides a high-level navigation guide to the codebase with plain-English summaries of each folder and file.

---

## 📁 Project Overview

This is a multi-portal real estate application with three frontend interfaces (customer, agent, admin) and a shared backend API. The application handles property listings, appointment booking with queue management, and user authentication.

```
real-estate-fullstack/
├── backend/               # Express.js REST API server
├── customer-frontend/     # Public customer-facing website
├── agent-frontend/        # Internal agent dashboard
├── admin-frontend/        # Administration dashboard
├── shared/               # Shared code for frontends
├── README.md             # Main documentation
└── INSTRUCTIONS.md       # This file
```

---

## 📂 Backend (`/backend/`)

The backend is a Node.js/Express application that provides REST API endpoints for all three frontends.

### Key Files

| File | Purpose |
|------|---------|
| `server.js` | **Entry point** - Starts the Express server, configures middleware, mounts routes |
| `package.json` | Dependencies and npm scripts (`npm start`, `npm test`) |
| `.env.example` | Template for environment variables (copy to `.env` and configure) |

### `/backend/config/`

| File | Purpose |
|------|---------|
| `database.js` | MySQL connection pool configuration and query helper functions |

**What it does**: Manages database connections. Use `db.query(sql, params)` to run parameterized queries.

### `/backend/middleware/`

| File | Purpose |
|------|---------|
| `auth.js` | Authentication and authorization middleware |

**What it does**: 
- `authenticate` - Verifies the Bearer token and attaches `req.user`
- `requireRole('admin', 'agent')` - Restricts access to specific roles
- `requireVerified` - Ensures customers have verified their phone
- `optionalAuth` - Attaches user if token present, but doesn't require it

**Example usage in routes**:
```javascript
// Only admin can access
router.get('/users', authenticate, requireRole('admin'), async (req, res) => {});

// Customer must be verified
router.post('/appointments', authenticate, requireVerified, async (req, res) => {});
```

### `/backend/routes/`

Each route file handles a specific domain of the API:

| File | Endpoints | Purpose |
|------|-----------|---------|
| `auth.js` | `/api/auth/*` | Registration, login, SMS verification |
| `properties.js` | `/api/properties/*` | CRUD for property listings and photo uploads |
| `appointments.js` | `/api/appointments/*` | Booking with queue management |
| `ratings.js` | `/api/ratings/*` | Agent rating system |
| `users.js` | `/api/users/*` | Admin user management |
| `notifications.js` | `/api/notifications/*` | In-app notification system |
| `waitlist.js` | `/api/waitlist/*` | Property interest waitlist |

**Key: `properties.js`** handles property management and image uploads:
- CRUD operations for property listings
- Image upload via multipart/form-data (using multer)
- Multiple images per property with primary image support
- Images stored in `backend/uploads/images/`
- Images served as static files via `/uploads/images/filename.jpg`

**Key: `appointments.js`** handles the complex booking queue logic:
- When a slot is already booked, new bookings go to a queue
- When a booking is cancelled, the next person in queue is automatically promoted
- Timestamps are recorded with microsecond precision for ordering

### `/backend/utils/`

| File | Purpose |
|------|---------|
| `auth.js` | Password hashing (bcrypt), token generation/validation |
| `verification.js` | SMS verification code generation (console-based for demo) |
| `auditLogger.js` | Event logging for bookings, queue events, access control |

**Audit Logger Usage**:
```javascript
const auditLogger = require('./utils/auditLogger');

// Log a booking event
auditLogger.logBooking('CREATED', { appointmentId: 123, customerId: 1 });

// Log access denied
auditLogger.logAccessDenied({ userId: 5, action: 'DELETE_PROPERTY' });

// Log queue promotion
auditLogger.logQueuePromotion({ customerId: 2, position: 1 });
```

### `/backend/sql/`

| File | Purpose |
|------|---------|
| `schema.sql` | Creates all database tables (run first) |
| `seed.sql` | Inserts demo data (admin, agents, sample properties) |

**Setup order**:
1. Create database: `CREATE DATABASE real_estate_db;`
2. Run schema: `mysql -u root -p real_estate_db < backend/sql/schema.sql`
3. Run seed: `mysql -u root -p real_estate_db < backend/sql/seed.sql`

### `/backend/tests/`

Simple unit tests using Node.js built-in `assert` module:

| File | Tests |
|------|-------|
| `roles.test.js` | Role-based access control logic |
| `queue.test.js` | Booking queue and promotion logic |
| `bookings.test.js` | Booking validation and business rules |

**Run tests**: `npm test` or `node tests/roles.test.js`

---

## 📂 Customer Frontend (`/customer-frontend/`)

Public-facing website for property browsing and booking.

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Homepage with featured properties |
| `properties.html` | Property listing with filters |
| `property.html` | Single property detail page |
| `appointments.html` | Customer's appointments dashboard |

### `/customer-frontend/js/`

| File | Purpose |
|------|---------|
| `config.js` | API URL configuration (supports override via `?api=` query param) |
| `api.js` | HTTP client wrapper for API calls |
| `auth.js` | Login, registration, verification handlers |
| `app.js` | Homepage functionality, featured properties |
| `properties.js` | Property listing page logic |
| `property-detail.js` | Property detail and booking modal |
| `appointments.js` | Customer appointments view |

**API URL Override**:
```javascript
// Change API URL via query parameter:
// http://localhost:3001?api=http://localhost:4000/api

// Or via JavaScript before loading config.js:
window.API_URL_OVERRIDE = 'https://api.example.com/api';
```

---

## 📂 Agent Frontend (`/agent-frontend/`)

Internal dashboard for real estate agents.

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page agent dashboard |

### `/agent-frontend/js/`

| File | Purpose |
|------|---------|
| `config.js` | API URL configuration |
| `api.js` | HTTP client wrapper |
| `app.js` | Dashboard functionality: properties, appointments, ratings display |

**Features**:
- View assigned properties
- Add/edit properties (auto-assigned to self)
- Manage appointments (confirm, complete, cancel)
- View rating summary and reviews

---

## 📂 Admin Frontend (`/admin-frontend/`)

Administration dashboard with full system control.

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page admin dashboard |

### `/admin-frontend/js/`

| File | Purpose |
|------|---------|
| `config.js` | API URL configuration |
| `api.js` | HTTP client wrapper |
| `app.js` | Dashboard: users, properties, appointments management |

**Features**:
- View system statistics
- Manage all users (create, edit, change roles)
- Manage all properties (create, edit, delete, assign agents)
- Oversee all appointments
- Mark properties as featured

---

## 📂 Shared (`/shared/`)

Code shared across all frontend applications.

### `/shared/js/`

| File | Purpose |
|------|---------|
| `api.js` | Unified API client (can replace per-portal api.js files) |
| `utils.js` | Common utilities: formatting, validation, HTML escaping |

**Usage**: Include in HTML after config.js:
```html
<script src="js/config.js"></script>
<script src="../shared/js/api.js"></script>
<script src="../shared/js/utils.js"></script>
```

---

## 🔑 Key Concepts

### Role-Based Access Control (RBAC)

The system has three roles:
- **Customer**: Can browse, book appointments, rate agents
- **Agent**: Can manage assigned properties and appointments
- **Admin**: Full system access

Roles are enforced at:
1. **Middleware level**: `requireRole('admin', 'agent')` blocks unauthorized routes
2. **Route level**: Additional checks like "agent can only edit their own properties"

### Booking Queue System

When multiple customers want the same time slot:

1. **First booking**: Status = `pending`, awaiting agent confirmation
2. **Later bookings**: Status = `queued`, position = 1, 2, 3...
3. **On cancellation**: First queued customer promoted to `confirmed`
4. **Notification**: Promoted customer receives in-app notification

### Notifications

All notifications are stored in the database and displayed in-app:
- Appointment confirmations/cancellations
- Queue promotions
- Rating notifications for agents
- System messages

---

## 🚀 Quick Start Commands

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Configure database credentials
npm start             # Start server on port 3000
npm test              # Run tests

# Customer Frontend
cd customer-frontend
npm start             # Serve on port 3001

# Agent Frontend  
cd agent-frontend
npm start             # Serve on port 3002

# Admin Frontend
cd admin-frontend
npm start             # Serve on port 3003
```

---

## 📝 Code Style Conventions

### JavaScript Comments

**File headers**:
```javascript
/**
 * Brief description of what this file does
 * 
 * @file filename.js
 * @description Detailed description
 * @module moduleName
 */
```

**Function documentation**:
```javascript
/**
 * Brief description of what the function does
 * 
 * @param {type} paramName - Description of parameter
 * @returns {type} Description of return value
 * 
 * @example
 * const result = myFunction(arg1, arg2);
 */
```

**Inline comments**:
```javascript
// Single-line comments explain WHY, not WHAT
// Use for complex logic or business rules

// ============================================================
// SECTION HEADERS for major code sections
// ============================================================
```

### SQL Comments

```sql
-- Single line comment

-- ============================================================
-- TABLE NAME
-- ============================================================
-- Description of what this table stores
-- Key fields and their purposes
-- ============================================================
```

---

## 📋 TODO: Future Features

See the main README.md for the full roadmap. Key upcoming features:

### Admin Analytics Dashboard
- Charts for bookings over time
- Agent performance metrics
- Property trend analysis

### ~~Document Upload System~~ ✅ Implemented
- ~~Property photos and floor plans~~
- ~~Agent can upload multiple images per property~~
- ~~Customers see photo gallery on listings~~

### ~~Property Lifecycle & Sales Tracking~~ ✅ Implemented
- ~~Mark as Sold/Rented with one click~~
- ~~Auto-cancel appointments and notify customers~~
- ~~Sales tracking for agent commissions~~
- ~~Archive system for sold properties~~
- ~~Sales Report with filters and CSV export~~

### Saved/Favorited Properties
- Customers can save properties for later
- View and manage favorites list
- Search within favorites

---

## 📷 Property Image Upload

### Overview

The application supports uploading multiple images per property. Images are stored on the server and served as static files.

### How It Works

1. **Uploading Images (Agent/Admin)**:
   - In the property form (Add/Edit), use the "Upload Images" file input
   - Select one or more images (max 5MB each, max 10 files)
   - Images are previewed before saving
   - On form submission, images are uploaded via multipart/form-data

2. **Managing Existing Photos**:
   - When editing a property, existing photos are displayed
   - Click the star (★) icon to set a photo as primary
   - Click the trash (🗑) icon to delete a photo

3. **Viewing Images (All Roles)**:
   - Property detail page displays an image gallery
   - Gallery supports navigation with prev/next buttons and thumbnails
   - Property cards show the primary image

### Storage Location

- Images are stored in: `backend/uploads/images/`
- Images are served at: `http://localhost:3000/uploads/images/filename.jpg`
- Filenames are generated uniquely: `property-{timestamp}-{random}.{ext}`

### API Endpoints

```javascript
// Get all photos for a property
GET /api/properties/:id/photos

// Upload photos (multipart/form-data with 'images' field)
POST /api/properties/:id/photos

// Set a photo as primary
PUT /api/properties/:propertyId/photos/:photoId/primary

// Delete a photo
DELETE /api/properties/:propertyId/photos/:photoId
```

### Database Schema

```sql
CREATE TABLE property_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    uploaded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);
```

### Upgrading Existing Installations

If upgrading from a previous version without image upload support:

1. Run the updated schema.sql to create the `property_photos` table
2. Ensure the `backend/uploads/images/` directory exists
3. Existing properties with `image_url` will continue to work (backward compatible)

---

## 🔧 Troubleshooting Quick Reference

### Backend Won't Start

| Error | Solution |
|-------|----------|
| `Cannot find module 'multer'` | Run `npm install` in backend directory |
| `ECONNREFUSED` to MySQL | Start MySQL: `sudo service mysql start` |
| `Access denied for user` | Check `.env` credentials match MySQL setup |
| `Table doesn't exist` | Run `schema.sql` then `seed.sql` |
| `EADDRINUSE` | Kill process on port or use different port |

### Frontend Issues

| Error | Solution |
|-------|----------|
| `Failed to load properties` | Check backend is running on port 3000 |
| CORS errors | Use `localhost` not `127.0.0.1`, check ports match config |
| Login fails silently | Check browser console, verify API URL in config.js |
| Images not displaying | Verify uploads directory exists and has permissions |

### Image Upload Issues

| Error | Solution |
|-------|----------|
| `File too large` | Images must be under 5MB |
| `Only image files allowed` | Check file is actually an image (JPEG, PNG, GIF, WebP) |
| Images upload but don't display | Check static file serving in server.js, verify file exists in uploads/ |

---

## 🧭 Common Workflows

### Adding a Property with Images (Agent/Admin)

```
1. Login to Agent (3002) or Admin (3003) portal
2. Navigate to Properties
3. Click "Add Property" button
4. Fill required fields:
   - Title, Address, City, State, ZIP
   - Price, Property Type, Listing Type
5. (Optional) Add description, bedrooms, bathrooms, etc.
6. Click "Choose Files" to select images
7. Preview images in the form
8. Click Save
9. Images are uploaded after property creation
```

### Managing Existing Property Photos

```
1. Edit an existing property
2. Scroll to "Existing Photos" section
3. To set primary: Click ★ icon on desired photo
4. To delete: Click 🗑 icon (with confirmation)
5. To add more: Use file input, then save
```

### Processing an Appointment (Agent)

```
1. Login to Agent portal
2. Go to Appointments tab
3. Filter by "Pending"
4. Click "Update" on an appointment
5. Change status to "Confirmed"
6. (After viewing) Change status to "Completed"
7. Customer can now rate you
```

### Rating an Agent (Customer)

```
1. Complete a viewing (agent marks as completed)
2. Go to My Appointments
3. Find the completed appointment
4. Click "Rate Agent" button
5. Select 1-5 stars
6. (Optional) Add written feedback
7. Submit - agent sees rating in their dashboard
```

### Marking a Property as Sold/Rented (Agent)

```
1. Login to Agent portal
2. Go to "My Properties" tab
3. Find the property you sold/rented
4. Click "Mark Sold" or "Mark Rented" button on the card
5. Confirm in the modal dialog
   - All pending appointments will be cancelled
   - Affected customers will be notified automatically
6. Property status updates and sale is recorded for commission tracking
7. View your sales in the "My Sales" tab
```

### Marking a Property as Sold (Admin)

```
1. Login to Admin portal
2. Go to Properties tab
3. Find the property to mark as sold
4. Click "Sold" or "Rented" button
5. In the modal, select which agent gets credit for the sale
6. Confirm - appointments cancelled, customers notified
7. View in "Sales Report" tab with filters
```

### Archiving Sold Properties

```
1. Property must already be sold or rented
2. Click "Archive" button on the property card
3. Property moves to archived state:
   - Hidden from customer listings
   - Remains in sales reports for record-keeping
4. Admin can unarchive from "Archived" tab if needed
```

### Viewing Sales Reports (Admin)

```
1. Login to Admin portal
2. Go to "Sales Report" tab
3. View all sold/rented properties
4. Filter by:
   - Agent (dropdown)
   - Date range (start/end)
5. Summary shows total sales count and value
6. Export to CSV for commission calculations
```

---

## 📋 Required Dependencies

### Backend (package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | Web framework |
| `mysql` | ^2.18.1 | MySQL driver |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `cors` | ^2.8.5 | Cross-origin requests |
| `dotenv` | ^16.3.1 | Environment variables |
| `multer` | ^2.0.2 | File uploads |

### Frontend

No npm dependencies - vanilla HTML/CSS/JS with optional `serve` for hosting:

```bash
npm install -g serve
```

---

## ❓ FAQ

**Q: How do I change the API URL?**  
A: Use the `?api=` query parameter or set `window.API_URL_OVERRIDE` before loading config.js.

**Q: Where are SMS verification codes?**  
A: In demo mode, codes are logged to the backend console. In production, integrate with an SMS service.

**Q: How do I add a new admin user?**  
A: Use the seed.sql pattern to INSERT a user with `role='admin'` and a bcrypt password hash.

**Q: Why can't a customer confirm their own appointment?**  
A: Business rule: appointments must be confirmed by agents to ensure availability.

**Q: Why don't I see properties I just created?**  
A: Check the status - customers only see "available" properties. Agents only see their assigned properties.

**Q: How do I reset a user's password?**  
A: Admin can edit any user and set a new password via the Admin portal.

**Q: Why is my image not showing?**  
A: Check: (1) File uploaded successfully (2) Backend serves /uploads as static (3) Filename in property_photos table matches actual file

**Q: Can I use external image URLs?**  
A: Yes, the legacy `image_url` field still works. New uploads use `property_photos` table.

**Q: How does queue promotion work?**  
A: When a booking is cancelled, the system automatically promotes the first queued customer (by booking timestamp) to confirmed status and sends them a notification.

**Q: Why can't I delete properties as an agent?**  
A: By design - only admins can delete properties to prevent accidental data loss. Agents can edit properties but not delete them.

---

## 📝 UX Findings Summary

### Key Issues Identified

1. **No password recovery** - Users locked out have no self-service option
2. **Console-based SMS** - Confusing for new users expecting real SMS
3. **Limited mobile support** - UI not optimized for mobile devices
4. **No loading indicators** - Some forms submit without visual feedback
5. **Inconsistent modals** - Close behavior varies between modals
6. **No empty states** - Lists show generic messages when empty

### Recommended Priorities

1. Add forgot password functionality
2. Implement real email/SMS verification
3. Make UI mobile-responsive
4. Add consistent loading states
5. Improve error messages with guidance

See README.md for detailed UX critique by role.
