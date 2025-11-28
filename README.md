# Real Estate Fullstack Application

A complete fullstack starter codebase for a real-estate application using Node.js (Express) with direct MySQL access for the backend, and separate frontend portals for customer, agent, and admin users.

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
│   │   ├── appointments.js    # Appointment booking system
│   │   ├── users.js           # User management (admin only)
│   │   ├── notifications.js   # User notifications
│   │   └── waitlist.js        # Property waitlist
│   ├── sql/
│   │   ├── schema.sql         # Database schema creation script
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
│   │   ├── property-detail.js # Single property view
│   │   └── appointments.js    # Customer appointments
│   ├── index.html             # Home page
│   ├── properties.html        # Property listings
│   ├── property.html          # Property details
│   └── appointments.html      # Customer appointments
│
├── agent-frontend/             # Internal agent portal
│   ├── css/styles.css
│   ├── js/
│   │   ├── config.js
│   │   ├── api.js
│   │   └── app.js
│   └── index.html             # Agent dashboard
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

**Using VSCode Live Server:**
- Open the HTML file in VSCode
- Right-click and select "Open with Live Server"
- Configure port in settings

## 👥 User Roles

### Customer (Public)
- **Access:** Customer frontend only (`http://localhost:3001`)
- **Registration:** Public registration with phone verification required
- **Features:**
  - Browse available properties
  - View property details
  - Schedule viewing appointments
  - Manage their appointments
  - Join property waitlists

### Agent (Internal)
- **Access:** Agent frontend only (`http://localhost:3002`)
- **Registration:** None - accounts created by admin
- **Default credentials:**
  - `agent1@realestate.com` / `agent123`
  - `agent2@realestate.com` / `agent123`
- **Features:**
  - View assigned properties
  - Manage appointments (confirm, complete, cancel)
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

3. **Manual SMS Send:**
   - Operator sees the code in console
   - Operator manually sends SMS to customer (for demo purposes)
   - In production, integrate with SMS service (Twilio, etc.)

4. **Verification:**
   - Customer enters code in verification modal
   - If valid and not expired, account is verified
   - Customer can now log in

5. **Resend Code:**
   - If code expires, customer can request new code
   - Previous codes are invalidated
   - New code logged to console

### API Endpoints

- `POST /api/auth/register` - Create account (triggers verification code)
- `POST /api/auth/verify` - Verify phone with code
- `POST /api/auth/resend-code` - Request new verification code
- `POST /api/auth/login` - Login (auto-sends code if unverified customer)

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
| GET | /api/appointments/:id | Get appointment details | Authenticated |
| POST | /api/appointments | Book appointment | Customer |
| PUT | /api/appointments/:id | Update appointment | Authenticated |
| DELETE | /api/appointments/:id | Delete appointment | Admin |

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

## 🎯 Demo Scenarios

### Scenario 1: Customer Registration & Booking
1. Open customer frontend (http://localhost:3001)
2. Click "Register" and fill in details
3. Watch backend console for verification code
4. Enter code in verification modal
5. Browse properties and schedule a viewing
6. Check "My Appointments" page

### Scenario 2: Agent Workflow
1. Open agent frontend (http://localhost:3002)
2. Login with `agent1@realestate.com` / `agent123`
3. View dashboard with assigned properties and appointments
4. Confirm or complete pending appointments

### Scenario 3: Admin Management
1. Open admin frontend (http://localhost:3003)
2. Login with `admin@realestate.com` / `admin123`
3. View dashboard statistics
4. Manage users (create new agent, deactivate customer)
5. Add/edit properties and assign to agents
6. Monitor all appointments

## 📝 License

ISC License - Feel free to use for learning and development.

---

Built for demo/learning purposes. For production use, implement proper JWT authentication, HTTPS, input validation, error handling, and SMS service integration.