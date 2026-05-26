# Sharda Helpdesk / University ERP

Full-stack university ERP for academic structure, identity & access, helpdesk operations, and student/faculty workflows.

## Main Features

- College, department, program, course, academic session, and section management
- Student, faculty, staff, and admin identity management
- Section-linked student enrollment and faculty assignment
- Timetable, attendance, assignments, opportunities, and notices
- Role and tier based access control

## Tech Stack

- Frontend: React, React Router, Axios
- Backend: Node.js, Express, MongoDB, Mongoose

## Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm start
```

## Environment

- Configure backend environment variables in `backend/.env`
- Configure frontend API base URL in `frontend/.env`

## Notes

- Backend runs on Express with MongoDB
- Frontend runs as a separate React app
- For a deeper system overview, see [PROJECT_SYSTEM_OVERVIEW.md](PROJECT_SYSTEM_OVERVIEW.md)
