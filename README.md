# Real Estate Fullstack Application

A complete fullstack starter codebase for a real-estate application using Node.js (Express) with direct MySQL access for the backend, and separate frontend portals for customer, agent, and admin users.

## ✨ Features Checklist

### Booking System
- [x] **Full datetime precision** - Booking timestamps include seconds for precise ordering
- [x] **Double-booking prevention** - Backend checks and prevents overlapping bookings
- [x] **Queuing system** - If a slot is taken, customers are added to a queue with position tracking
- [x] **Instant queue promotion** - When a booking is cancelled, next customer in queue is automatically promoted
- [x] **High-demand warnings** - Frontend displays warning about queue possibility during booking
- [x] **Blocked slots** - Ability to block specific time slots for properties
- [x] **Real-time status updates** - Customer dashboards show confirmed, queued, promoted, or cancelled status

### Agent Ratings
- [x] **Post-viewing ratings** - Customers can rate agents after completed viewings
- [x] **One rating per appointment** - Prevents duplicate ratings
- [x] **Self-rating prevention** - Agents cannot rate themselves
- [x] **Rating display** - Agent ratings visible on property pages
- [x] **Rating summary** - Average rating and total reviews shown
- [x] **Feedback collection** - Optional text feedback with ratings

### Property Management
- [x] **Full CRUD operations** - Agents can add and edit their assigned properties
- [x] **Admin property control** - Admin can manage all properties
- [x] **Agent assignment** - Properties assigned to specific agents
- [x] **Featured properties** - Admin can mark properties as featured
- [x] **Status management** - Available, pending, sold, rented statuses

### User Management
- [x] **Role-based access** - Customer, Agent, Admin roles
- [x] **Phone verification** - SMS verification for customer registration
- [x] **Profile management** - Users can view and manage their profiles
- [x] **Account activation** - Admin can activate/deactivate accounts

## 🏗️ Project Structure

```
real-estate-fullstack/
├── backend/                    # Express API server
│   ├── config/
│   │   └── database.js        # MySQL connection pool configuration
│   ├── middleware/
│   │   └── auth.js            # Authentication middleware
│   ├── routes/
│   │   ├── auth.js            # Authentication routes (register, login, verify)
│   │   ├── properties.js      # Property CRUD operations
│   │   ├── appointments.js    # Appointment booking with queue system
│   │   ├── ratings.js         # Agent rating system
│   │   ├── users.js           # User management (admin only)
│   │   ├── notifications.js   # User notifications
│   │   └── waitlist.js        # Property waitlist
│   ├── sql/
│   │   ├── schema.sql         # Database schema (all tables)
│   │   └── seed.sql           # Sample data including admin/agent users
│   ├── utils/
│   │   ├── auth.js            # Password hashing, token generation
│   │   └── verification.js    # SMS verification code logic
│   ├── .env.example           # Environment variables template
│   ├── package.json
│   └── server.js              # Main server entry point
│
├── customer-frontend/          # Public customer portal
│   ├── css/styles.css
│   ├── js/
│   │   ├── config.js          # API configuration
│   │   ├── api.js             # API helper functions
│   │   ├── auth.js            # Authentication handling
│   │   ├── app.js             # Main application logic
│   │   ├── properties.js      # Property listing page
│   │   ├── property-detail.js # Single property view with ratings
│   │   └── appointments.js    # Customer appointments with rating UI
│   ├── index.html             # Home page
│   ├── properties.html        # Property listings
│   ├── property.html          # Property details with agent rating
│   └── appointments.html      # Customer appointments with rating modal
│
├── agent-frontend/             # Internal agent portal
│   ├── css/styles.css
│   ├── js/
│   │   ├── config.js
│   │   ├── api.js
│   │   └── app.js             # Agent dashboard with property management
│   └── index.html             # Agent dashboard with ratings display
│
├── admin-frontend/             # Company admin portal
│   ├── css/styles.css
│   ├── js/
│   │   ├── config.js
│   │   ├── api.js
│   │   └── app.js
│   └── index.html             # Admin dashboard
│
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MySQL Server (v5.7 or higher)
- VSCode (recommended)

### 1. Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE real_estate_db;
```

2. Run the schema creation script:
```bash
mysql -u root -p real_estate_db < backend/sql/schema.sql
```

3. Run the seed data script (creates admin/agent users and sample properties):
```bash
mysql -u root -p real_estate_db < backend/sql/seed.sql
```

### 2. Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from template:
```bash
cp .env.example .env
```

4. Edit `.env` with your database credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=real_estate_db
DB_PORT=3306
PORT=3000
JWT_SECRET=your_secret_key_here
```

5. Start the backend server:
```bash
npm start
```

The API server will run at `http://localhost:3000`

### 3. Frontend Setup

Each frontend can be served using any static file server. For development, you can use:

**Using Python:**
```bash
# Customer Frontend (port 3001)
cd customer-frontend && python -m http.server 3001

# Agent Frontend (port 3002)
cd agent-frontend && python -m http.server 3002

# Admin Frontend (port 3003)
cd admin-frontend && python -m http.server 3003
```

**Using Node.js (npx serve):**
```bash
# Install serve globally (once)
npm install -g serve

# Customer Frontend
serve customer-frontend -l 3001

# Agent Frontend
serve agent-frontend -l 3002

# Admin Frontend
serve admin-frontend -l 3003
```

## 💾 Database Schema

### Tables Overview

| Table | Description |
|-------|-------------|
| `users` | User accounts (customers, agents, admins) |
| `properties` | Property listings with details |
| `appointments` | Booking records with queue support |
| `agent_ratings` | Customer ratings for agents |
| `agent_assignments` | Agent-property assignments |
| `blocked_slots` | Blocked time slots for properties |
| `notifications` | User notification messages |
| `verifications` | Phone verification codes |
| `waitlist` | Property interest waitlist |

### Key Tables Structure

#### appointments
```sql
- id (PK)
- property_id (FK -> properties)
- customer_id (FK -> users)
- agent_id (FK -> users)
- appointment_date
- appointment_time
- booking_timestamp (DATETIME(6) - microsecond precision)
- status (pending/confirmed/completed/cancelled/queued)
- queue_position (INT, NULL if confirmed)
- notes
- created_at, updated_at
```

#### agent_ratings
```sql
- id (PK)
- agent_id (FK -> users)
- customer_id (FK -> users)
- appointment_id (FK -> appointments, UNIQUE)
- rating (1-5)
- feedback (TEXT)
- created_at
```

#### blocked_slots
```sql
- id (PK)
- property_id (FK -> properties)
- blocked_date
- blocked_time
- reason
- blocked_by (FK -> users)
- created_at
```

## 👥 User Roles

### Customer (Public)
- **Access:** Customer frontend only (`http://localhost:3001`)
- **Registration:** Public registration with phone verification required
- **Features:**
  - Browse available properties
  - View property details with agent ratings
  - Schedule viewing appointments (with queue awareness)
  - Manage their appointments
  - Rate agents after completed viewings
  - Join property waitlists

### Agent (Internal)
- **Access:** Agent frontend only (`http://localhost:3002`)
- **Registration:** None - accounts created by admin
- **Default credentials:**
  - `agent1@realestate.com` / `agent123`
  - `agent2@realestate.com` / `agent123`
- **Features:**
  - View and edit assigned properties
  - Add new properties (auto-assigned)
  - Manage appointments (confirm, complete, cancel)
  - View their ratings and feedback
  - View notifications

### Admin (Company)
- **Access:** Admin frontend only (`http://localhost:3003`)
- **Registration:** None - accounts pre-seeded
- **Default credentials:**
  - `admin@realestate.com` / `admin123`
- **Features:**
  - Full user management (CRUD)
  - Full property management (CRUD)
  - Appointment oversight
  - Agent assignment
  - Dashboard statistics

## 📅 Booking Logic & Business Rules

### Double-Booking Prevention

When a customer books a viewing:
1. System records `booking_timestamp` with microsecond precision
2. System checks if slot (property + date + time) is already taken
3. If slot is blocked → Booking rejected with error message
4. If slot is already booked → Customer is added to **queue**
5. Queue position is calculated based on booking timestamp order

### Queue System

- **Status: `queued`** - Customer is waiting for slot to become available
- **Queue Position** - Shows customer their position in line (e.g., "#1", "#2")
- **Instant Promotion** - When a booking is cancelled:
  - Next customer in queue is automatically promoted to `confirmed`
  - All other queue positions are decremented
  - Promoted customer receives instant notification

### Customer-Facing Warning

Before booking, customers see:
> ⚠️ **High-Demand Notice:** In high-demand periods, multiple customers may try to book the same time slot simultaneously. If your preferred slot is already taken, you'll be added to a queue and notified immediately if it becomes available. Please check your confirmation status after booking.

### Status Flow

```
[New Booking]
    │
    ├─── Slot Available ───> pending ───> confirmed ───> completed
    │                                         │
    └─── Slot Taken ───────> queued ──────────┘ (via promotion)
                               │
                               └─── cancelled
```

## ⭐ Agent Rating System

### Rating Rules

1. **Only customers can rate** - Agents and admins cannot rate
2. **Only after completion** - Rating available only for `completed` appointments
3. **One rating per appointment** - No duplicate ratings allowed
4. **No self-rating** - Customers can only rate other users

### Rating Flow

1. Customer completes a viewing appointment
2. Appointment page shows "Rate Agent" button
3. Customer selects 1-5 stars and optional feedback
4. Agent receives notification of new rating
5. Rating appears on agent's profile and property pages

### Rating Display

- **Property Page:** Shows agent's average rating and review count
- **Agent Dashboard:** Shows their overall rating summary
- **Reviews:** Anonymized customer names (e.g., "J***") for privacy

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/auth/register | Customer registration | Public |
| POST | /api/auth/verify | Verify phone number | Public |
| POST | /api/auth/resend-code | Resend verification code | Public |
| POST | /api/auth/login | User login | Public |
| GET | /api/auth/me | Get current user | Authenticated |

### Properties
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/properties | List properties | Public |
| GET | /api/properties/featured | Get featured properties | Public |
| GET | /api/properties/:id | Get property details | Public |
| POST | /api/properties | Create property | Admin/Agent |
| PUT | /api/properties/:id | Update property | Admin/Agent |
| DELETE | /api/properties/:id | Delete property | Admin |

### Appointments
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/appointments | List appointments | Authenticated |
| GET | /api/appointments/available-slots/:propertyId | Get available slots | Public |
| GET | /api/appointments/:id | Get appointment details | Authenticated |
| POST | /api/appointments | Book appointment (with queue) | Customer |
| PUT | /api/appointments/:id | Update appointment | Authenticated |
| DELETE | /api/appointments/:id | Delete appointment | Admin |

### Ratings
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/ratings | Submit agent rating | Customer |
| GET | /api/ratings/agent/:agentId | Get agent's ratings | Public |
| GET | /api/ratings/agent/:agentId/summary | Get rating summary | Public |
| GET | /api/ratings/can-rate/:appointmentId | Check if can rate | Customer |

### Users (Admin Only)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/users | List all users | Admin |
| GET | /api/users/agents | List agents | Admin/Agent |
| GET | /api/users/:id | Get user details | Admin |
| PUT | /api/users/:id | Update user | Admin |

### Notifications
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/notifications | List notifications | Authenticated |
| PUT | /api/notifications/:id/read | Mark as read | Authenticated |
| PUT | /api/notifications/read-all | Mark all as read | Authenticated |

### Waitlist
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/waitlist | List waitlist entries | Authenticated |
| POST | /api/waitlist | Join waitlist | Customer |
| DELETE | /api/waitlist/:id | Leave waitlist | Authenticated |

## 📱 SMS Verification Workflow

The application uses a console-based SMS verification system for demo/development:

### How It Works

1. **Customer Registration:**
   - Customer submits registration form with phone number
   - Backend generates a 6-digit verification code
   - Code is stored in `verifications` table with 10-minute expiry
   - Code is logged to the backend console

2. **Console Output:**
   ```
   ========================================
   📱 SMS VERIFICATION CODE
   ========================================
   Phone: +1-555-123-4567
   Code: 847293
   Expires: 2024-01-15T10:35:00.000Z
   ========================================
   ⚠️  Operator: Please manually send this code via SMS
   ========================================
   ```

3. **Verification:**
   - Customer enters code in verification modal
   - If valid and not expired, account is verified
   - Customer can now log in

## 💾 Database Export/Import

### Export Database
```bash
# Export entire database
mysqldump -u root -p real_estate_db > backup.sql

# Export only data (no schema)
mysqldump -u root -p --no-create-info real_estate_db > data_backup.sql
```

### Import Database
```bash
# Import from backup
mysql -u root -p real_estate_db < backup.sql

# Fresh setup (schema + seed)
mysql -u root -p real_estate_db < backend/sql/schema.sql
mysql -u root -p real_estate_db < backend/sql/seed.sql
```

### Reset Database
```bash
# Drop and recreate
mysql -u root -p -e "DROP DATABASE IF EXISTS real_estate_db; CREATE DATABASE real_estate_db;"
mysql -u root -p real_estate_db < backend/sql/schema.sql
mysql -u root -p real_estate_db < backend/sql/seed.sql
```

## 🛠️ Development Notes

### Technology Stack
- **Backend:** Node.js, Express.js
- **Database:** MySQL (using `mysql` npm package - no ORM)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Authentication:** Custom token-based (Base64 encoded JSON)

### No External Dependencies
- No ORMs (Sequelize, TypeORM, etc.)
- No SaaS integrations
- No paid APIs
- All can run locally in VSCode

### Data Flow
1. All data changes go through the backend API
2. Frontend makes REST API calls
3. Backend executes SQL queries directly
4. Changes are instantly visible on page refresh/reload

### Security Notes
- Passwords hashed with bcryptjs
- Token-based authentication
- Role-based access control
- SQL injection prevented via parameterized queries
- XSS prevention via HTML escaping

## 🎯 Demo Scenarios

### Scenario 1: Customer Registration & Booking
1. Open customer frontend (http://localhost:3001)
2. Click "Register" and fill in details
3. Watch backend console for verification code
4. Enter code in verification modal
5. Browse properties and schedule a viewing
6. Note the high-demand warning message
7. Check "My Appointments" page for status

### Scenario 2: Queue System Demo
1. Book a viewing as Customer A
2. Register as Customer B and book same slot
3. Customer B sees "Queued #1" status
4. Customer A cancels their booking
5. Customer B is automatically promoted to "Confirmed"

### Scenario 3: Agent Rating Flow
1. As agent, confirm and complete a booking
2. As customer, view completed appointment
3. Click "Rate Agent" button
4. Submit star rating and feedback
5. View rating on property page

### Scenario 4: Agent Property Management
1. Open agent frontend (http://localhost:3002)
2. Login with `agent1@realestate.com` / `agent123`
3. Navigate to "My Properties"
4. Click "Add Property" to create new listing
5. Edit existing property details

### Scenario 5: Admin Management
1. Open admin frontend (http://localhost:3003)
2. Login with `admin@realestate.com` / `admin123`
3. View dashboard statistics
4. Manage users (create new agent, deactivate customer)
5. Add/edit properties and assign to agents
6. Monitor all appointments including queued ones

## 📝 License

ISC License - Feel free to use for learning and development.

---

Built for demo/learning purposes. For production use, implement proper JWT authentication, HTTPS, input validation, error handling, and SMS service integration.