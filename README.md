# Real Estate Fullstack Application

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-v14+-339933?style=flat-square&logo=node.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=flat-square&logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)

**A complete fullstack real estate platform with separate portals for customers, agents, and administrators.**

[Features](#-features) • [Quick Start](#-quick-start) • [User Journeys](#-user-journeys) • [Architecture](#-architecture) • [Roadmap](#-roadmap)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [User Journeys](#-user-journeys)
- [Business Logic Deep Dive](#-business-logic-deep-dive)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Screenshots](#-screenshots)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Fullstack vs Frontend-Only Comparison](#-fullstack-vs-frontend-only-comparison)
- [Roadmap & TODO](#-roadmap--todo)
- [Security Notes](#-security-notes)
- [License](#-license)

---

## Overview

This is a **production-ready fullstack starter** for building real estate platforms. It demonstrates:

- **Multi-role authentication** with customer, agent, and admin portals
- **Second-level precision booking** with automatic queue management
- **Real-time notifications** and status updates
- **Agent rating system** with privacy-preserving reviews
- **Complete CRUD operations** for properties, users, and appointments

**Key differentiator:** Unlike frontend-only demos with mock data, this application features:
- ✅ Real MySQL persistence
- ✅ Multi-user concurrent access handling
- ✅ Backend event processing (queue promotion, notifications)
- ✅ True role-based access control enforced server-side

---

## ✨ Features

### 🏠 Property Management
| Feature | Description | Roles |
|---------|-------------|-------|
| **Full CRUD Operations** | Create, read, update, delete property listings | Admin, Agent |
| **Agent Assignment** | Properties assigned to specific agents for accountability | Admin |
| **Featured Properties** | Highlight premium listings on homepage | Admin |
| **Multi-status Tracking** | Available, Pending, Sold, Rented status management | Admin, Agent |
| **Property Types** | House, Apartment, Condo, Land, Commercial | All |
| **Listing Types** | For Sale, For Rent | All |
| **Rich Details** | Bedrooms, bathrooms, square feet, lot size, year built | All |
| **Image Upload** | Upload multiple images per property via multipart/form-data | Admin, Agent |
| **Image Gallery** | Display property images in a browsable gallery | All |
| **Legacy Image URLs** | Backward compatible support for external image URLs | Admin, Agent |

### 📅 Booking System (Second-Level Precision)
| Feature | Description |
|---------|-------------|
| **Microsecond Timestamps** | `DATETIME(6)` precision for exact booking order |
| **Double-Booking Prevention** | Server-side slot conflict detection |
| **Automatic Queuing** | When slot taken, customer added to queue |
| **Instant Promotion** | Cancelled booking → next customer auto-promoted |
| **High-Demand Warnings** | Frontend alerts about queue possibility |
| **Blocked Slots** | Agents can block times for unavailability |
| **Status Tracking** | Pending → Confirmed → Completed / Cancelled / Queued |

### ⭐ Agent Rating System
| Feature | Description |
|---------|-------------|
| **Post-Viewing Ratings** | 1-5 stars after completed appointments |
| **One Rating Per Appointment** | Prevents duplicate/spam ratings |
| **Self-Rating Prevention** | Server-enforced restriction |
| **Optional Feedback** | Text comments with ratings |
| **Privacy Protection** | Customer names anonymized (e.g., "J***") |
| **Rating Summary** | Average rating, total reviews, distribution breakdown |
| **Agent Notifications** | Agents notified of new ratings |

### 👥 User Management & Authentication
| Feature | Description |
|---------|-------------|
| **Role-Based Access Control** | Customer, Agent, Admin with enforced permissions |
| **Phone Verification** | 6-digit SMS code (console-based for demo) |
| **Secure Password Storage** | bcrypt hashing |
| **Token Authentication** | Session tokens for API access |
| **Account Activation** | Admin can enable/disable accounts |
| **Profile Management** | Users can view and update profiles |

### 🔔 Notification System
| Feature | Description |
|---------|-------------|
| **Appointment Notifications** | Booking confirmations, cancellations, promotions |
| **Rating Notifications** | Agents notified of new reviews |
| **System Notifications** | Account status changes |
| **Read/Unread Tracking** | Mark individual or all as read |

### 📋 Additional Features
| Feature | Description |
|---------|-------------|
| **Property Waitlist** | Customers can express interest |
| **Agent Assignments Tracking** | Historical assignment records |
| **Dashboard Statistics** | Admin overview of platform metrics |
| **Pagination** | All list endpoints support pagination |
| **Filtering** | Filter by status, type, price range, etc. |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                              │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│  Customer Portal│   Agent Portal  │        Admin Portal             │
│  (port 3001)    │   (port 3002)   │        (port 3003)              │
│                 │                 │                                 │
│  • Browse props │  • Manage props │  • User management              │
│  • Book viewing │  • Appointments │  • Property oversight           │
│  • Rate agents  │  • View ratings │  • Agent assignments            │
│  • Waitlist     │  • Notifications│  • System statistics            │
└────────┬────────┴────────┬────────┴────────────────┬────────────────┘
         │                 │                         │
         │            REST API Calls                 │
         ▼                 ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND API LAYER                               │
│                     (Express.js - port 3000)                        │
├─────────────────────────────────────────────────────────────────────┤
│  Authentication Middleware │ Role-Based Access Control              │
├─────────────────────────────────────────────────────────────────────┤
│  Routes:                                                            │
│  • /api/auth/*        - Registration, Login, Verification           │
│  • /api/properties/*  - Property CRUD                               │
│  • /api/appointments/*- Booking with queue management               │
│  • /api/ratings/*     - Agent rating system                         │
│  • /api/users/*       - User management (admin)                     │
│  • /api/notifications/*- Notification handling                      │
│  • /api/waitlist/*    - Property waitlist                           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                           SQL Queries
                           (Parameterized)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                                  │
│                     (MySQL 5.7+)                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Tables: users, properties, appointments, agent_ratings,            │
│          agent_assignments, blocked_slots, notifications,           │
│          verifications, waitlist                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚶 User Journeys

### Customer Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CUSTOMER JOURNEY                               │
└─────────────────────────────────────────────────────────────────────┘

1. REGISTRATION & VERIFICATION
   ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
   │ Register│───>│ Receive SMS │───>│ Enter Code  │───>│ Verified │
   │  Form   │    │ Code (6-dig)│    │ in Modal    │    │  Account │
   └─────────┘    └─────────────┘    └─────────────┘    └──────────┘

2. PROPERTY DISCOVERY
   ┌──────────┐    ┌────────────┐    ┌───────────────┐
   │ Homepage │───>│ Browse All │───>│ View Property │
   │ Featured │    │ Properties │    │ Details + Agent│
   │ Listings │    │ with Filters│   │ Rating        │
   └──────────┘    └────────────┘    └───────────────┘

3. BOOKING A VIEWING
   ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐
   │ Select Date  │───>│ See Warning  │───>│ Submit Request     │
   │ & Time Slot  │    │ (High Demand)│    │                    │
   └──────────────┘    └──────────────┘    └─────────┬──────────┘
                                                     │
                    ┌────────────────────────────────┴────────────┐
                    │                                             │
                    ▼                                             ▼
          ┌─────────────────┐                           ┌─────────────────┐
          │ SLOT AVAILABLE  │                           │  SLOT TAKEN     │
          │ Status: Pending │                           │ Status: Queued  │
          │                 │                           │ Position: #N    │
          └────────┬────────┘                           └────────┬────────┘
                   │                                             │
                   ▼                                             │
          ┌─────────────────┐                                    │
          │ Agent Confirms  │◄───────────────────────────────────┘
          │ Status: Confirmed                    (via promotion)
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐    ┌─────────────────┐
          │ Attend Viewing  │───>│ Agent Marks     │
          │                 │    │ Complete        │
          └─────────────────┘    └────────┬────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ RATE AGENT      │
                                 │ 1-5 Stars +     │
                                 │ Feedback        │
                                 └─────────────────┘
```

### Agent Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT JOURNEY                                │
└─────────────────────────────────────────────────────────────────────┘

1. LOGIN (Account created by Admin)
   ┌─────────────┐    ┌───────────────────┐
   │ Login with  │───>│ Agent Dashboard   │
   │ Credentials │    │ • Stats Overview  │
   │             │    │ • Rating Display  │
   └─────────────┘    │ • Notifications   │
                      └───────────────────┘

2. PROPERTY MANAGEMENT
   ┌───────────────┐    ┌────────────────┐    ┌────────────────┐
   │ View Assigned │───>│ Edit Property  │───>│ Add New        │
   │ Properties    │    │ Details        │    │ Property       │
   └───────────────┘    └────────────────┘    │ (Auto-assigned)│
                                              └────────────────┘

3. APPOINTMENT WORKFLOW
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ View Pending │───>│ Confirm      │───>│ Conduct      │
   │ Requests     │    │ Appointment  │    │ Viewing      │
   └──────────────┘    └──────────────┘    └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┴───────────┐
                    ▼                                         ▼
          ┌─────────────────┐                       ┌─────────────────┐
          │ Mark Completed  │                       │ Cancel (if      │
          │ • Customer can  │                       │ needed)         │
          │   now rate      │                       │ • Queue promotes│
          └─────────────────┘                       └─────────────────┘

4. VIEW RATINGS & FEEDBACK
   ┌───────────────────────────────────────┐
   │ Dashboard shows:                      │
   │ • Average Rating (★ 4.5)              │
   │ • Total Reviews (12)                  │
   │ • Recent Feedback                     │
   └───────────────────────────────────────┘
```

### Admin Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN JOURNEY                                │
└─────────────────────────────────────────────────────────────────────┘

1. DASHBOARD OVERVIEW
   ┌─────────────────────────────────────────────────────────────────┐
   │ Statistics at a Glance:                                         │
   │ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
   │ │Total Users│ │Properties │ │Appointments│ │Active     │       │
   │ │    45     │ │    28     │ │    156    │ │Agents: 8  │       │
   │ └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
   └─────────────────────────────────────────────────────────────────┘

2. USER MANAGEMENT
   ┌────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │ View All Users │───>│ Filter by Role  │───>│ Edit User       │
   │ (paginated)    │    │ (Customer/Agent)│    │ • Change Role   │
   └────────────────┘    └─────────────────┘    │ • Activate/     │
                                                │   Deactivate    │
                                                │ • Reset Password│
                                                └─────────────────┘

3. PROPERTY MANAGEMENT
   ┌────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │ All Properties │───>│ Add Property    │───>│ Assign Agent    │
   │ (any status)   │    │                 │    │                 │
   └────────────────┘    │ Edit Property   │    │ Mark Featured   │
                         │                 │    │                 │
                         │ Delete Property │    │ Change Status   │
                         └─────────────────┘    └─────────────────┘

4. APPOINTMENT OVERSIGHT
   ┌─────────────────────────────────────────────────────────────────┐
   │ View all appointments across all agents and customers           │
   │ • Filter by status (pending/confirmed/completed/cancelled)      │
   │ • See queued customers and their positions                      │
   │ • Edit appointment details                                      │
   │ • Hard delete appointments (admin-only)                         │
   └─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Business Logic Deep Dive

### Booking System: Second-Level Precision Queue Management

The booking system is designed to handle high-concurrency scenarios where multiple users might try to book the same slot simultaneously.

**How It Works:**

```sql
-- Booking timestamp with microsecond precision
booking_timestamp DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
```

**Booking Flow:**

```
Customer A books slot 10:00 AM on Jan 15    → Status: PENDING
                                               booking_timestamp: 2024-01-14 15:30:45.123456

Customer B books same slot 2 seconds later  → Status: QUEUED, Position: 1
                                               booking_timestamp: 2024-01-14 15:30:47.789012

Customer C books same slot 5 seconds later  → Status: QUEUED, Position: 2
                                               booking_timestamp: 2024-01-14 15:30:52.345678
```

**Queue Promotion Logic:**

```javascript
// When Customer A cancels:
async function promoteNextInQueue(propertyId, date, time) {
    // 1. Find queued booking with lowest queue_position
    // 2. Update status to 'confirmed', clear queue_position
    // 3. Decrement all other queue positions
    // 4. Create notification for promoted customer
}
```

**Result after Customer A cancels:**
- Customer B → Status: CONFIRMED (was queued)
- Customer C → Position: 1 (was 2)
- Customer B receives notification: "🎉 Booking Confirmed! Your queued booking has been promoted."

### Agent Rating System Logic

**Eligibility Check Flow:**

```javascript
// Can this customer rate this appointment?
GET /api/ratings/can-rate/:appointmentId

Checks:
1. Is user a customer? (agents/admins cannot rate)
2. Is this their appointment? (can't rate others' appointments)
3. Is appointment completed? (can't rate pending/cancelled)
4. Is there an agent assigned?
5. Has this appointment already been rated? (one rating per appointment)
```

**Privacy-Preserving Display:**

```sql
-- Customer names anonymized in public display
SELECT CONCAT(LEFT(c.first_name, 1), '***') as customer_name
-- "John" becomes "J***"
```

**Rating Summary Calculation:**

```sql
SELECT 
    COUNT(*) as total_ratings,
    AVG(rating) as average_rating,
    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
    -- ... etc
FROM agent_ratings WHERE agent_id = ?
```

### Role-Based Access Control

**Server-Side Enforcement:**

| Action | Customer | Agent | Admin |
|--------|----------|-------|-------|
| Browse properties | ✅ Available only | ✅ All | ✅ All |
| Create property | ❌ | ✅ Auto-assigned | ✅ Assign any |
| Edit property | ❌ | ✅ Own only | ✅ Any |
| Delete property | ❌ | ❌ | ✅ |
| Book appointment | ✅ | ❌ | ❌ |
| Confirm appointment | ❌ | ✅ Own | ✅ Any |
| Cancel appointment | ✅ Own | ✅ Own | ✅ Any |
| Rate agent | ✅ | ❌ | ❌ |
| Create user | ❌ | ❌ | ✅ |
| View all users | ❌ | ❌ | ✅ |

---

## 📁 Project Structure

```
real-estate-fullstack/
│
├── backend/                          # Express.js API Server
│   ├── config/
│   │   └── database.js              # MySQL connection pool configuration
│   │
│   ├── middleware/
│   │   └── auth.js                  # Authentication & authorization middleware
│   │                                 # - authenticate: Verify token
│   │                                 # - requireRole: Check user role
│   │                                 # - requireVerified: Check phone verification
│   │                                 # - optionalAuth: Auth if token present
│   │
│   ├── routes/
│   │   ├── auth.js                  # POST /register, /login, /verify, /resend-code
│   │   ├── properties.js            # CRUD with agent assignment
│   │   ├── appointments.js          # Booking with queue management
│   │   ├── ratings.js               # Agent rating system
│   │   ├── users.js                 # Admin user management
│   │   ├── notifications.js         # User notifications
│   │   ├── waitlist.js              # Property waitlist
│   │   └── todo/                    # TODO: Future feature skeletons
│   │       ├── analytics.js         # Admin analytics dashboard (stub)
│   │       ├── documents.js         # Document upload system (stub)
│   │       └── favorites.js         # Saved properties (stub)
│   │
│   ├── sql/
│   │   ├── schema.sql               # Complete database schema (9 tables)
│   │   └── seed.sql                 # Demo data: admin, agents, properties
│   │
│   ├── tests/                       # Unit tests (Node.js assert)
│   │   ├── roles.test.js            # Role-based authorization tests
│   │   ├── queue.test.js            # Booking queue logic tests
│   │   └── bookings.test.js         # Booking validation tests
│   │
│   ├── utils/
│   │   ├── auth.js                  # Password hashing, token generation
│   │   ├── verification.js          # SMS code generation (console-based)
│   │   └── auditLogger.js           # Event logging for audit trail
│   │
│   ├── .env.example                 # Environment variables template
│   ├── package.json
│   └── server.js                    # Main entry point
│
├── shared/                           # Shared Frontend Code
│   ├── js/
│   │   ├── api.js                   # Unified API client (shared)
│   │   └── utils.js                 # Formatting, validation, helpers
│   └── README.md                    # Shared code documentation
│
├── customer-frontend/                # Public Customer Portal (port 3001)
│   ├── css/
│   │   └── styles.css               # Customer-facing styles
│   ├── js/
│   │   ├── config.js                # API base URL configuration
│   │   ├── api.js                   # HTTP client wrapper
│   │   ├── auth.js                  # Login/register/verify handlers
│   │   ├── app.js                   # Homepage & navigation
│   │   ├── properties.js            # Property listing page
│   │   ├── property-detail.js       # Single property + booking modal
│   │   └── appointments.js          # My appointments + rating modal
│   │
│   ├── index.html                   # Homepage with featured properties
│   ├── properties.html              # All properties with filters
│   ├── property.html                # Property detail + agent rating display
│   ├── appointments.html            # Customer appointments management
│   └── package.json                 # npm start script
│
├── agent-frontend/                   # Internal Agent Portal (port 3002)
│   ├── css/
│   │   └── styles.css               # Agent portal styles
│   ├── js/
│   │   ├── config.js
│   │   ├── api.js
│   │   └── app.js                   # Dashboard, properties, appointments
│   │
│   ├── index.html                   # Single-page agent dashboard
│   └── package.json                 # npm start script
│
├── admin-frontend/                   # Company Admin Portal (port 3003)
│   ├── css/
│   │   └── styles.css               # Admin portal styles
│   ├── js/
│   │   ├── config.js
│   │   ├── api.js
│   │   └── app.js                   # Full management capabilities
│   │
│   ├── index.html                   # Single-page admin dashboard
│   └── package.json                 # npm start script
│
├── README.md                        # This documentation
└── INSTRUCTIONS.md                  # Navigation guide and function summaries
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | v14+ | Runtime for backend |
| MySQL | 5.7+ | Primary database |
| npm | 6+ | Package manager |

### Step 1: Database Setup

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE real_estate_db;
exit;

# Run schema (creates all tables)
mysql -u root -p real_estate_db < backend/sql/schema.sql

# Run seed data (creates demo users and properties)
mysql -u root -p real_estate_db < backend/sql/seed.sql
```

**Seed Data Includes:**
- Admin: `admin@realestate.com` / `admin123`
- Agent 1: `agent1@realestate.com` / `agent123`
- Agent 2: `agent2@realestate.com` / `agent123`
- 10 sample properties (3 featured)

### Step 2: Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
```

**.env Configuration:**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=real_estate_db
DB_PORT=3306
PORT=3000
JWT_SECRET=your_secret_key_here_change_in_production
```

```bash
# Start the server
npm start

# Server runs at http://localhost:3000
# Health check: GET http://localhost:3000/api/health
```

### Step 3: Frontend Setup

Each frontend is a static HTML/CSS/JS application. Serve them using any static file server:

**Option A: Python (built-in)**
```bash
# Terminal 1 - Customer Frontend
cd customer-frontend && python -m http.server 3001

# Terminal 2 - Agent Frontend  
cd agent-frontend && python -m http.server 3002

# Terminal 3 - Admin Frontend
cd admin-frontend && python -m http.server 3003
```

**Option B: Node.js (npx serve)**
```bash
# Install serve globally
npm install -g serve

# Terminal 1 - Customer Frontend
serve customer-frontend -l 3001

# Terminal 2 - Agent Frontend
serve agent-frontend -l 3002

# Terminal 3 - Admin Frontend
serve admin-frontend -l 3003
```

**Option C: VS Code Live Server**
1. Install "Live Server" extension
2. Right-click each `index.html` → "Open with Live Server"
3. Configure ports in settings

### Step 4: Access the Application

| Portal | URL | Credentials |
|--------|-----|-------------|
| Customer | http://localhost:3001 | Register new account |
| Agent | http://localhost:3002 | agent1@realestate.com / agent123 |
| Admin | http://localhost:3003 | admin@realestate.com / admin123 |

---

## 📸 Screenshots

> **Note:** These placeholders indicate where screenshots should be added. Run the application locally to capture actual screenshots.

### Customer Portal

| Screenshot | Description |
|------------|-------------|
| `screenshots/customer-home.png` | Homepage with featured properties and search |
| `screenshots/customer-properties.png` | Property listing page with filters |
| `screenshots/customer-property-detail.png` | Single property view with agent rating |
| `screenshots/customer-booking-modal.png` | Booking modal with high-demand warning |
| `screenshots/customer-appointments.png` | My appointments with status (confirmed/queued) |
| `screenshots/customer-rating-modal.png` | Agent rating modal (1-5 stars + feedback) |
| `screenshots/customer-queue-status.png` | Queued appointment showing position |

### Agent Portal

| Screenshot | Description |
|------------|-------------|
| `screenshots/agent-dashboard.png` | Dashboard with statistics and rating display |
| `screenshots/agent-properties.png` | Assigned properties list |
| `screenshots/agent-property-form.png` | Add/Edit property modal |
| `screenshots/agent-appointments.png` | Appointment management with status tabs |
| `screenshots/agent-appointment-update.png` | Update appointment status modal |

### Admin Portal

| Screenshot | Description |
|------------|-------------|
| `screenshots/admin-dashboard.png` | Overview statistics (users, properties, appointments) |
| `screenshots/admin-users.png` | User management table with role filters |
| `screenshots/admin-user-edit.png` | User edit modal (role, status, password) |
| `screenshots/admin-properties.png` | All properties with status/type filters |
| `screenshots/admin-property-form.png` | Property form with agent assignment |
| `screenshots/admin-appointments.png` | All appointments oversight |

---

## 🔌 API Reference

### Authentication Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/register` | Customer registration | Public |
| `POST` | `/api/auth/verify` | Verify phone with code | Public |
| `POST` | `/api/auth/resend-code` | Resend verification code | Public |
| `POST` | `/api/auth/login` | User login | Public |
| `GET` | `/api/auth/me` | Get current user | Authenticated |

### Properties Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/properties` | List properties (filtered by role) | Public |
| `GET` | `/api/properties/featured` | Get featured properties | Public |
| `GET` | `/api/properties/:id` | Get property details (includes photos) | Public |
| `POST` | `/api/properties` | Create property | Admin/Agent |
| `PUT` | `/api/properties/:id` | Update property | Admin/Agent (own) |
| `DELETE` | `/api/properties/:id` | Delete property | Admin |

### Property Photos Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/properties/:id/photos` | Get all photos for a property | Public |
| `POST` | `/api/properties/:id/photos` | Upload photos (multipart/form-data) | Admin/Agent (own) |
| `PUT` | `/api/properties/:propertyId/photos/:photoId/primary` | Set photo as primary | Admin/Agent (own) |
| `DELETE` | `/api/properties/:propertyId/photos/:photoId` | Delete a photo | Admin/Agent (own) |

**Photo Upload Example:**
```bash
# Upload images using curl
curl -X POST http://localhost:3000/api/properties/1/photos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"
```

**Accessing Uploaded Images:**
```
# Images are served as static files
http://localhost:3000/uploads/images/filename.jpg
```

### Appointments Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/appointments` | List appointments (role-filtered) | Authenticated |
| `GET` | `/api/appointments/available-slots/:propertyId` | Get available time slots | Public |
| `GET` | `/api/appointments/:id` | Get appointment details | Authenticated |
| `POST` | `/api/appointments` | Book appointment (with queue) | Customer (verified) |
| `PUT` | `/api/appointments/:id` | Update appointment | Authenticated |
| `DELETE` | `/api/appointments/:id` | Delete appointment | Admin |

### Ratings Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/ratings` | Submit agent rating | Customer (verified) |
| `GET` | `/api/ratings/agent/:agentId` | Get agent's ratings | Public |
| `GET` | `/api/ratings/agent/:agentId/summary` | Get rating summary | Public |
| `GET` | `/api/ratings/can-rate/:appointmentId` | Check rating eligibility | Authenticated |

### Users Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/users` | List all users | Admin |
| `GET` | `/api/users/agents` | List agents | Admin/Agent |
| `GET` | `/api/users/:id` | Get user details | Admin |
| `PUT` | `/api/users/:id` | Update user | Admin |

### Notifications Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/notifications` | List user notifications | Authenticated |
| `PUT` | `/api/notifications/:id/read` | Mark as read | Authenticated |
| `PUT` | `/api/notifications/read-all` | Mark all as read | Authenticated |

### Waitlist Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/waitlist` | List waitlist entries | Authenticated |
| `POST` | `/api/waitlist` | Join waitlist | Customer |
| `DELETE` | `/api/waitlist/:id` | Leave waitlist | Authenticated |

---

## 💾 Database Schema

### Tables Overview

| Table | Description | Key Features |
|-------|-------------|--------------|
| `users` | All user accounts | Role enum, verification status, activation |
| `verifications` | Phone verification codes | 10-minute expiry, one-time use |
| `properties` | Property listings | Type/status enums, agent assignment, featured flag |
| `property_photos` | Uploaded property images | Multiple images per property, primary flag, display order |
| `appointments` | Booking records | `DATETIME(6)` precision, queue position |
| `agent_ratings` | Customer ratings | 1-5 scale, unique per appointment |
| `agent_assignments` | Assignment history | Status tracking (active/completed/reassigned) |
| `blocked_slots` | Unavailable times | Agent blocks for properties |
| `notifications` | User messages | Type categorization, read status |
| `waitlist` | Property interest | Position tracking |

### SQL Table Creation (Run Order)

Run these SQL files in order after creating the database:

```bash
# Step 1: Create the database
mysql -u root -p -e "CREATE DATABASE real_estate_db;"

# Step 2: Run schema (creates all tables)
mysql -u root -p real_estate_db < backend/sql/schema.sql

# Step 3: Run seed data (creates demo users and properties)
mysql -u root -p real_estate_db < backend/sql/seed.sql
```

### Complete Table Schemas

**Users Table:**
```sql
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('customer', 'agent', 'admin') NOT NULL DEFAULT 'customer',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Properties Table:**
```sql
CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    property_type ENUM('house', 'apartment', 'condo', 'land', 'commercial') NOT NULL,
    listing_type ENUM('sale', 'rent') NOT NULL,
    bedrooms INT DEFAULT 0,
    bathrooms DECIMAL(3, 1) DEFAULT 0,
    square_feet INT DEFAULT 0,
    lot_size DECIMAL(10, 2) DEFAULT 0,
    year_built INT,
    status ENUM('available', 'pending', 'sold', 'rented') DEFAULT 'available',
    featured BOOLEAN DEFAULT FALSE,
    image_url VARCHAR(500),
    created_by INT,
    assigned_agent_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**Appointments Table (Queue Support):**
```sql
CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    customer_id INT NOT NULL,
    agent_id INT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    booking_timestamp DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'queued'),
    queue_position INT DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**Agent Ratings Table:**
```sql
CREATE TABLE IF NOT EXISTS agent_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    customer_id INT NOT NULL,
    appointment_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_appointment_rating (appointment_id),
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);
```

**Notifications Table:**
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('appointment', 'property', 'verification', 'system') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 🔧 API URL Configuration

### Switching API Endpoints (No .env Needed)

Each frontend supports API URL override without modifying source files:

**Method 1: Query Parameter**
```
http://localhost:3001?api=http://localhost:4000/api
http://localhost:3002?api=https://api.staging.example.com/api
```

**Method 2: JavaScript Variable (before config.js loads)**
```html
<script>window.API_URL_OVERRIDE = 'https://api.production.example.com/api';</script>
<script src="js/config.js"></script>
```

**Method 3: Edit config.js Default**
```javascript
// In customer-frontend/js/config.js (or agent/admin)
const CONFIG = {
    API_URL: window.API_URL_OVERRIDE || 'http://your-server:3000/api',
    // ...
};
```

---

## 📝 Notification & Audit Logging

### In-App Notifications

All notifications are stored in the database `notifications` table and displayed in the user's portal:

| Event | Recipient | Message Type |
|-------|-----------|--------------|
| New booking request | Agent | appointment |
| Booking confirmed | Customer | appointment |
| Booking cancelled | Customer/Agent | appointment |
| Queue promotion | Customer | appointment |
| Rating received | Agent | property |

**Creating Notifications (Backend):**
```javascript
await db.query(`
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (?, 'appointment', 'Booking Confirmed', ?)
`, [userId, 'Your appointment has been confirmed!']);
```

### Audit Logging (Console/File)

The audit logger (`backend/utils/auditLogger.js`) provides event tracking:

```javascript
const auditLogger = require('./utils/auditLogger');

// Log booking events
auditLogger.logBooking('CREATED', { appointmentId: 123, customerId: 1, propertyId: 5 });

// Log queue race conditions
auditLogger.logRaceCondition('BOOKING', {
    propertyId: 5,
    slot: '2024-01-15 10:00:00',
    users: [1, 2]
});

// Log access denied
auditLogger.logAccessDenied({
    userId: 3,
    userRole: 'customer',
    action: 'DELETE_PROPERTY',
    requiredRole: 'admin'
});
```

**Enable File Logging:**
```bash
AUDIT_LOG_FILE=true AUDIT_LOG_PATH=./logs/audit.log npm start
```

---

## ✅ Running Tests

Simple unit tests using Node.js built-in `assert`:

```bash
cd backend

# Run all tests
npm test

# Run individual test files
npm run test:roles     # Role-based authorization tests
npm run test:queue     # Booking queue logic tests
npm run test:bookings  # Booking validation tests
```

---

## 📐 Code Commenting Conventions

### JavaScript File Headers

```javascript
/**
 * Brief description of the file
 * 
 * @file filename.js
 * @description Detailed description of what this module does
 * @module moduleName (for backend routes)
 */
```

### Function Documentation (JSDoc)

```javascript
/**
 * Brief description of what the function does
 * 
 * @param {type} paramName - Description of the parameter
 * @param {Object} options - Options object
 * @param {string} options.field - Description of options.field
 * @returns {Promise<Object>} Description of return value
 * 
 * @example
 * const result = await myFunction(arg1, { field: 'value' });
 * 
 * @fires EVENT_NAME (for functions that trigger events)
 * @throws {ErrorType} Description of when this error is thrown
 */
async function myFunction(paramName, options) {
    // Implementation
}
```

### Section Headers (for long files)

```javascript
// ============================================================================
// SECTION NAME
// ============================================================================
```

### Inline Comments

```javascript
// Single-line comments explain WHY, not WHAT
// Good: "Customer must be verified to prevent spam bookings"
// Bad: "Check if customer is verified"

// Multi-line for complex logic:
// This algorithm handles race conditions by:
// 1. Recording microsecond-precision timestamps
// 2. Using database locking for concurrent access
// 3. Assigning queue positions based on timestamp order
```

### SQL Comments

```sql
-- Single line comment

-- ============================================================================
-- TABLE NAME
-- ============================================================================
-- Description of what this table stores
-- Key relationships and constraints
-- ============================================================================
CREATE TABLE table_name (...);
```

---

## 🔄 Fullstack vs Frontend-Only Comparison

This fullstack application differs significantly from frontend-only demos (like `frontend-pt2` mock-data versions):

| Aspect | Frontend-Only (Mock Data) | This Fullstack Version |
|--------|--------------------------|------------------------|
| **Data Persistence** | LocalStorage/SessionStorage | MySQL Database |
| **Multi-User Support** | Single browser session | True concurrent users |
| **Queue Management** | Simulated | Real-time with microsecond precision |
| **Notifications** | In-memory | Persisted, user-specific |
| **Authentication** | Client-side tokens | Server-validated sessions |
| **Access Control** | Frontend checks only | Server-enforced RBAC |
| **Data Integrity** | No validation | Foreign keys, constraints |
| **Concurrent Bookings** | Race conditions possible | Proper conflict handling |
| **Rating System** | Can be bypassed | Server-enforced rules |

### What's Only Possible in Fullstack:

1. **True Queue Promotion**: When Customer A cancels, Customer B is automatically promoted server-side
2. **Cross-Session Notifications**: Agent sees ratings submitted by any customer
3. **Audit Trail**: All actions logged with timestamps in database
4. **Data Survival**: Restart browser/server, data persists
5. **Concurrent Testing**: Open multiple browsers, book same slot, see queue in action
6. **Role Enforcement**: Can't bypass admin-only features by editing frontend code

---

## 🗺 Roadmap & TODO

### Missing Features (Common in Production Real Estate Apps)

#### High Priority
- [ ] **Admin Analytics Dashboard** - Charts for bookings over time, agent performance, property trends
- [ ] **Document Upload System** - Property photos, floor plans, compliance documents
- [ ] **Saved/Favorited Properties** - Customers can save properties for later
- [ ] **Search History** - Track recent searches per user
- [ ] **Email Notifications** - Replace console SMS with real email (SendGrid, SES)

#### Medium Priority
- [ ] **Map Integration** - Google Maps/Mapbox for property locations
- [ ] **Push Notifications** - Browser/mobile push for instant alerts
- [ ] **Mortgage Calculator** - Estimate monthly payments
- [ ] **Virtual Tour Links** - Integration with Matterport/similar
- [ ] **Compliance Document Upload** - Agent license verification
- [ ] **Rich Agent Profiles** - Bio, certifications, specialties
- [ ] **Property Comparison** - Side-by-side compare 2-3 properties

#### Lower Priority
- [ ] **Advanced Search Filters** - School district, amenities, HOA
- [ ] **Scheduled Reports** - Weekly/monthly admin reports via email
- [ ] **API Rate Limiting** - Prevent abuse
- [ ] **WebSocket Real-Time Updates** - Live status changes without refresh
- [ ] **Multi-Language Support** - i18n for international markets
- [ ] **Dark Mode** - Theme switching
- [ ] **PWA Support** - Installable mobile app experience

#### Technical Improvements
- [ ] **Proper JWT Authentication** - Replace Base64 tokens with signed JWTs
- [ ] **HTTPS Enforcement** - SSL/TLS in production
- [ ] **Input Sanitization Library** - Use validator.js or similar
- [ ] **Structured Logging** - Winston/Pino with log levels
- [ ] **Unit/Integration Tests** - Jest + Supertest
- [ ] **CI/CD Pipeline** - GitHub Actions for testing/deployment
- [ ] **Docker Compose** - Easy local setup
- [ ] **Environment-Based Config** - Development/staging/production configs
- [ ] **Database Migrations** - Sequelize migrations or raw SQL versioning

---

## 🔒 Security Notes

### Current Implementation
- ✅ Passwords hashed with `bcryptjs`
- ✅ Token-based authentication
- ✅ Role-based access control (server-enforced)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (HTML escaping in frontend)
- ✅ CORS restricted to known frontend origins

### Production Recommendations
- ⚠️ Replace Base64 tokens with signed JWTs
- ⚠️ Implement HTTPS everywhere
- ⚠️ Add request rate limiting
- ⚠️ Implement CSRF protection
- ⚠️ Add input validation library
- ⚠️ Set secure cookie flags
- ⚠️ Implement proper session management
- ⚠️ Change all demo credentials before deployment

### Demo Credentials (Change Before Production!)
```
⚠️ SECURITY WARNING ⚠️
These credentials are publicly known in this repository.
NEVER use them in a production environment.

Admin: admin@realestate.com / admin123
Agent1: agent1@realestate.com / agent123
Agent2: agent2@realestate.com / agent123
```

---

## 🎯 Demo Scenarios

### Scenario 1: Complete Customer Journey
1. Open http://localhost:3001
2. Click "Register" → Fill form → Watch backend console for verification code
3. Enter code → Account verified
4. Browse properties → Click one → See agent rating
5. Click "Schedule Viewing" → Note high-demand warning → Submit
6. Check "My Appointments" → See status (pending/queued)
7. Ask admin/agent to confirm and complete
8. Return to appointments → Click "Rate Agent" → Submit rating

### Scenario 2: Queue Promotion Demo
1. As Customer A: Book slot at 10:00 AM on specific date → Status: Pending
2. As Customer B: Book same slot → Status: Queued, Position: #1
3. As Customer A: Cancel booking
4. Verify Customer B is now "Confirmed" (auto-promoted)
5. Check Customer B's notifications for promotion message

### Scenario 3: Agent Workflow
1. Open http://localhost:3002 → Login as agent1
2. View dashboard statistics and rating
3. Navigate to "My Properties" → Edit a property
4. Navigate to "Appointments" → Confirm a pending request
5. Later: Mark same appointment as "Completed"

### Scenario 4: Admin Full Control
1. Open http://localhost:3003 → Login as admin
2. View dashboard overview
3. Users tab → Change a customer to agent role
4. Properties tab → Create new property → Assign to agent
5. Mark property as "Featured"
6. Appointments tab → View all bookings including queued ones

---

## 📝 License

**ISC License** - Feel free to use for learning and development.

---

## 🤝 Contributing

This is a demo/learning project. Contributions welcome for:
- Bug fixes
- Documentation improvements
- Feature additions from the roadmap
- Test coverage
- Security improvements

---

<div align="center">

**Built for learning and demonstration purposes.**

For production use, implement proper security measures, HTTPS, and replace demo credentials.

</div>