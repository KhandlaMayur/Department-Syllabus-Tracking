# Syllabus Tracker — Marwadi University Department Portal

**Phase 1: Project Foundation** — architecture, auth, layout, and
database scaffolding. No syllabus-tracking business logic yet; that's
Phase 2+.

## Stack

| Layer     | Technology                                  |
|-----------|----------------------------------------------|
| Frontend  | React 19 + Vite, React Router, Axios          |
| Backend   | Node.js + Express (REST, `/api/v1`)           |
| Database  | MySQL 8 / MariaDB 10+                         |
| Auth      | Google OAuth 2.0 + JWT sessions                |

## What's in Phase 1

**Frontend**
- Public login page with Google Sign-In
- Placeholder dashboards for Student, Faculty, CC, and HOD roles
- Responsive sidebar + navbar + page container layout system
- Loading / error / empty state components
- API service layer (Axios) and AuthContext for session management
- Theme system (teal/cyan, inspired by the Marwadi University look)

**Backend**
- Express server with CORS, Helmet, centralized error handling,
  request validation, request logging, and `/api/v1` versioning
- Modular controllers → services → models structure
- Google ID token verification + JWT issuing
- Health-check endpoint (`/api/v1/health`, reports DB connectivity)

**Database**
- `syllabus_tracker` MySQL database
- `roles`, `departments`, `users` tables with PKs, FKs, unique
  constraints, indexes, and `created_at`/`updated_at` timestamps
- Migration scripts (run in order) + seed data (roles + a starter
  department)

## Quick start

You'll need **Node.js 18+** and a running **MySQL/MariaDB** server.

### 1. Database

Make sure MySQL is running and reachable with the `root` user and an
empty password on `127.0.0.1:3306` (or adjust `.env` in step 2 to match
your setup).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
#  → edit .env: add your Google OAuth Client ID/Secret,
#    set ALLOWED_EMAIL_DOMAIN if you want to restrict sign-in
npm run db:init     # creates the DB, tables, and seed data
npm run dev         # starts the API on http://localhost:5000
```

Verify: `curl http://localhost:5000/api/v1/health` should return
`"database":"up"`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
#  → edit .env: set VITE_GOOGLE_CLIENT_ID to the same client ID as the backend
npm run dev         # starts the app on http://localhost:5173
```

Open **http://localhost:5173** — you should see the login page. Signing
in with a Google account auto-creates a `student` user (the default
role) and routes you to `/student`.

### Trying other roles

Phase 1 has no admin UI for role management yet. To view the Faculty,
CC, or HOD dashboards, update a user's role directly in the database
after they've signed in once:

```sql
UPDATE users u
JOIN roles r ON r.name = 'hod'
SET u.role_id = r.id
WHERE u.email = 'someone@marwadiuniversity.ac.in';
```

## Google OAuth setup (one-time)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Add `http://localhost:5173` as an **Authorized JavaScript origin**.
4. Copy the Client ID into both `backend/.env` (`GOOGLE_CLIENT_ID`) and
   `frontend/.env` (`VITE_GOOGLE_CLIENT_ID`). Copy the Client Secret
   into `backend/.env` (`GOOGLE_CLIENT_SECRET`) — the frontend never
   needs the secret.

## Project structure

```
syllabus-tracker/
├── backend/          Express API, MySQL migrations/seeds, README
├── frontend/          React + Vite app, README
└── README.md          (this file)
```

See `backend/README.md` and `frontend/README.md` for deeper detail on
each side.

## Roadmap (beyond Phase 1)

Phase 1 deliberately stops at the foundation. Future phases (not part
of this deliverable) would typically add: subjects/syllabus/topics
tables and CRUD, faculty topic-completion tracking, CC/HOD analytics
and reports, an admin UI for role/department assignment, and
notifications.
