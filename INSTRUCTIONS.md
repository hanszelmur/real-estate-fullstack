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
| `properties.js` | `/api/properties/*` | CRUD for property listings |
| `appointments.js` | `/api/appointments/*` | Booking with queue management |
| `ratings.js` | `/api/ratings/*` | Agent rating system |
| `users.js` | `/api/users/*` | Admin user management |
| `notifications.js` | `/api/notifications/*` | In-app notification system |
| `waitlist.js` | `/api/waitlist/*` | Property interest waitlist |

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

### Document Upload System
- Property photos and floor plans
- Agent can upload multiple images per property
- Customers see photo gallery on listings

### Saved/Favorited Properties
- Customers can save properties for later
- View and manage favorites list
- Search within favorites

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
