# 🎓 Sharda University Helpdesk System

A full-stack **MERN** (MongoDB, Express.js, React.js, Node.js) Helpdesk Ticket Management System built for Sharda University. Students can raise support tickets, agents handle them, and admins have full oversight.

---

## 📸 Features at a Glance

| Feature | Details |
|---|---|
| **Roles** | Student · Support Agent · Admin |
| **Auth** | JWT-based, role-based access control |
| **Tickets** | Create · Assign · Track · Reply |
| **Chat** | Thread-style replies with internal notes |
| **Dashboard** | Live stats, charts (Recharts), recent activity |
| **Filters** | By status, category, priority, full-text search |
| **File Upload** | Attach files to tickets and replies (≤5 MB) |
| **AI Hints** | Keyword-based priority auto-suggestion |
| **User Mgmt** | Admin can create/edit/delete agents & students |

---

## 🏗️ Project Structure

```
sharda-helpdesk/
├── backend/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js      # Register, login, profile
│   │   ├── ticketController.js    # Full ticket CRUD + replies
│   │   ├── userController.js      # Admin user management
│   │   └── statsController.js     # Dashboard statistics
│   ├── middleware/
│   │   ├── auth.js                # JWT protect + authorize
│   │   ├── errorHandler.js        # Global error handler
│   │   └── upload.js              # Multer file upload
│   ├── models/
│   │   ├── User.js                # User schema (bcrypt, JWT)
│   │   └── Ticket.js              # Ticket + Reply sub-schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── ticketRoutes.js
│   │   ├── userRoutes.js
│   │   └── statsRoutes.js
│   ├── utils/
│   │   └── seed.js                # Demo data seeder
│   ├── uploads/                   # Uploaded files (auto-created)
│   ├── .env.example
│   ├── package.json
│   └── server.js                  # Express entry point
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Layout.js           # Sidebar + topbar shell
    │   │   ├── TicketCard.js       # Ticket list card
    │   │   └── ui.js               # Reusable UI primitives
    │   ├── context/
    │   │   └── AuthContext.js      # Global auth state (useReducer)
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   ├── RegisterPage.js
    │   │   ├── Dashboard.js        # Stats + charts
    │   │   ├── TicketList.js       # Filterable ticket list
    │   │   ├── CreateTicket.js     # New ticket form + AI hint
    │   │   ├── TicketDetail.js     # Chat-style thread + admin panel
    │   │   ├── UsersPage.js        # Admin user management table
    │   │   ├── ProfilePage.js      # Profile & password change
    │   │   └── NotFound.js
    │   ├── utils/
    │   │   ├── api.js              # Axios instance + interceptors
    │   │   └── helpers.js          # Formatters, colour maps, constants
    │   ├── App.js                  # Router + route guards
    │   └── index.js
    ├── tailwind.config.js
    ├── .env.example
    └── package.json
```

---

## ⚡ Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | v18 or later |
| npm | v9 or later |
| MongoDB | Local (v6+) or MongoDB Atlas |

---

### 1. Clone / download the project

```bash
git clone <your-repo-url>
cd sharda-helpdesk
```

---

### 2. Backend setup

```bash
cd backend
npm install
```

Create your `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/sharda_helpdesk
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRE=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Seed demo data (recommended for first run):**

```bash
node utils/seed.js
```

This creates:

| Role    | Email                     | Password   |
|---------|---------------------------|------------|
| Admin   | admin@sharda.ac.in        | admin123   |
| Agent   | agent@sharda.ac.in        | agent123   |
| Student | student@sharda.ac.in      | student123 |

**Start the backend:**

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Backend runs at: `http://localhost:5000`

---

### 3. Frontend setup

Open a **new terminal**:

```bash
cd frontend
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

`.env` contents:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

**Start the frontend:**

```bash
npm start
```

Frontend runs at: `http://localhost:3000`

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register new student |
| POST | `/api/auth/login` | Public | Login and get JWT |
| GET | `/api/auth/me` | Private | Get current user |
| PUT | `/api/auth/updateprofile` | Private | Update profile |
| PUT | `/api/auth/changepassword` | Private | Change password |

### Tickets
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/tickets` | Private | List tickets (role-filtered) |
| POST | `/api/tickets` | Private | Create ticket (multipart) |
| GET | `/api/tickets/:id` | Private | Get single ticket |
| PUT | `/api/tickets/:id` | Private | Update ticket |
| DELETE | `/api/tickets/:id` | Admin | Delete ticket |
| POST | `/api/tickets/:id/replies` | Private | Add reply |

**Query params for GET /api/tickets:**
`?status=Open&category=IT+Support&priority=High&search=wifi&page=1&limit=10`

### Users (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create agent/admin |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/api/users/agents` | List agents (for assignment) |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |

---

## 🎨 Tech Stack

### Backend
- **Express.js** — REST API framework
- **Mongoose** — MongoDB ODM with schema validation
- **bcryptjs** — Password hashing
- **jsonwebtoken** — JWT auth tokens
- **multer** — File upload handling
- **express-validator** — Input validation
- **morgan** — HTTP request logging

### Frontend
- **React 18** — UI library
- **React Router v6** — Client-side routing
- **Axios** — HTTP client with interceptors
- **Tailwind CSS** — Utility-first CSS
- **Recharts** — Charts and data visualization
- **React Hot Toast** — Toast notifications
- **React Icons** — Icon library
- **date-fns** — Date formatting
- **Context API + useReducer** — State management

---

## 🔐 Role Permissions

| Action | Student | Agent | Admin |
|---|:---:|:---:|:---:|
| Create ticket | ✅ | ✅ | ✅ |
| View own tickets | ✅ | — | ✅ |
| View all tickets | ❌ | ✅ | ✅ |
| Reply to ticket | ✅ | ✅ | ✅ |
| Internal notes | ❌ | ✅ | ✅ |
| Assign tickets | ❌ | ❌ | ✅ |
| Update status/priority | ❌ | ✅ | ✅ |
| Delete tickets | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| View dashboard stats | Own | Assigned | All |

---

## 📁 Ticket Categories

`IT Support` · `Administration` · `Hostel` · `Library` · `Finance` · `Academic` · `Infrastructure` · `Other`

## 🏷️ Ticket Priorities

`Low` · `Medium` · `High` · `Critical`

## 📊 Ticket Statuses

`Open` → `In Progress` → `Resolved` → `Closed`

---

## 🤖 AI Priority Suggestion

When creating a ticket, the system scans the title and description for keywords:

- **High priority** triggered by: `urgent`, `emergency`, `critical`, `broken`, `not working`, `cannot access`, `immediately`
- **Low priority** triggered by: `suggestion`, `feedback`, `question`, `inquiry`, `info`

The AI banner appears in the Create Ticket form, and you can apply or ignore the suggestion.

---

## 🚀 Deployment

### Backend (e.g. Railway / Render)
1. Set environment variables in the platform dashboard
2. Change `MONGO_URI` to your MongoDB Atlas URI
3. Set `NODE_ENV=production`
4. Deploy the `backend/` folder

### Frontend (e.g. Vercel / Netlify)
1. Set `REACT_APP_API_URL` to your deployed backend URL
2. Run `npm run build`
3. Deploy the `frontend/build/` folder

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| `MongoDB connection error` | Make sure MongoDB is running locally or use Atlas URI |
| `CORS error` | Set `FRONTEND_URL` in backend `.env` to your React dev server |
| `JWT invalid` | Check `JWT_SECRET` is set and consistent |
| `Upload not working` | Ensure `backend/uploads/` folder is writable |
| Demo login fails | Run `node utils/seed.js` first |

---

## 📄 License

MIT — Free to use and modify for educational purposes.

---

*Built with ❤️ for Sharda University*
