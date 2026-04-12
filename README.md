# Sharda University Helpdesk

Full-stack university operations platform: identity, academics, helpdesk ticketing, notices, events, group chat, and dashboards. **Stack:** MongoDB, Express, React, Node (MERN-class), JWT auth, optional Redis (cache + email job queue), SMTP for outbound mail.

**Authoritative architecture and module map:** see [`PROJECT_SYSTEM_OVERVIEW.md`](./PROJECT_SYSTEM_OVERVIEW.md) (kept up to date with routes, permissions, and major features).

---

## Features at a glance

| Area | Details |
|------|---------|
| **Identity** | Registration, email verification, optional Google sign-in, account lifecycle, scoped admins (`AdminScope`) |
| **Access** | Role + permission keys + admin tiers (`super_admin`, college/department scoping, etc.) |
| **Helpdesk** | Tickets, assignments, threaded replies, internal notes, file attachments, scoped access for staff |
| **Academics** | Structure (colleges → departments → programs → sections), timetable, attendance, assignments |
| **Content** | Notice board, events, opportunities, academic calendar (manage route for publishers) |
| **Realtime** | Socket.IO (tickets, notifications, group chat) |
| **AI** | Chat assistant, categorization, ticket summarize (staff), FAQ cache |

---

## Repository layout (summary)

```
sharda-helpdesk/
├── backend/          # Express API — see server.js for mounted routes
│   ├── config/       # db, redis, cache
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── queues/       # Bull email queue (Redis)
│   ├── routes/
│   ├── services/     # Business logic (tickets, users, academics, …)
│   ├── socket/
│   └── utils/
├── frontend/         # React app (App.js, pages/, contexts/, components/)
├── PROJECT_SYSTEM_OVERVIEW.md
└── README.md         # This file — quick start & pointers
```

---

## Quick start

### Prerequisites

- **Node.js** v18+
- **MongoDB** (local or Atlas)
- **Redis** (optional — recommended for FAQ cache and background emails; app degrades if Redis is down)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: MONGO_URI, JWT_SECRET, FRONTEND_URL, EMAIL_* for SMTP, REDIS_* if using Redis
```

Default API port in `.env.example` is **8080** (override with `PORT`).

```bash
npm run dev
# or: npm start
```

Seed demo data (if provided in your repo):

```bash
node utils/seed.js
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# REACT_APP_API_URL must match your API origin, e.g. http://localhost:8080/api
npm start
```

---

## API surface

Core patterns:

- **`/api/auth/*`** — login, register, profile, verification  
- **`/api/tickets/*`** — tickets and replies (list queries are role- and scope-filtered)  
- **`/api/users/*`**, **`/api/admin-scope/*`**, **`/api/permissions/*`** — provisioning and governance  
- **`/api/academics/*`**, **`/api/assignments/*`**, **`/api/content/*`**, **`/api/announcements/*`**, **`/api/events/*`**, **`/api/academic-calendar/*`** — academics and content  
- **`/api/chat/*`** — AI assistant  
- **`/api/files/:scope/:filename`** — authenticated download. **`general`**: file must belong to a ticket, profile image, assignment, submission, event poster, or content/announcement attachment you may access; **`chat`**: message must exist and you must be a group member or platform admin. **`/uploads/...` is not served** (use API + JWT / `?token=`).

For a full route list, open [`backend/server.js`](./backend/server.js) or [`PROJECT_SYSTEM_OVERVIEW.md`](./PROJECT_SYSTEM_OVERVIEW.md).

---

## Tech stack (high level)

**Backend:** Express, Mongoose, JWT (cookie + Bearer), Socket.IO, Bull + ioredis (optional), Nodemailer (SMTP), Winston, Multer.

**Frontend:** React, React Router, Axios, Tailwind, contexts for auth/permissions/theme/notifications.

---

## Deployment notes

- Set **`MONGO_URI`**, **`JWT_SECRET`**, **`FRONTEND_URL`**, and **`EMAIL_*`** (SMTP) in production.  
- Configure **`REDIS_*`** if you rely on caching or the email queue.  
- Build the frontend with **`REACT_APP_API_URL`** pointing at the deployed API.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| API connection errors | `REACT_APP_API_URL` port matches `PORT` / `FRONTEND_URL` and CORS |
| Email not sending | SMTP vars in `.env`; queue falls back to direct send if Redis unavailable |
| Redis warnings | Optional; FAQ cache and Bull queue skip if Redis is absent |

---

## License

MIT — suitable for educational use.
