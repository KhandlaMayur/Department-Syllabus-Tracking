# Syllabus Tracker — Backend (Phase 1)

Node.js + Express REST API, MySQL, Google OAuth 2.0.

## Structure

```
src/
  config/       env.js (central env loader), db.js (MySQL pool)
  controllers/  request handlers (thin — call services)
  services/     business logic (auth verification, user provisioning)
  models/       raw SQL data-access layer
  routes/v1/    versioned route definitions
  middleware/   auth, validation, error handling, logging
  utils/        logger, ApiError, catchAsync
  app.js        Express app (middleware + routes)
  server.js     HTTP server bootstrap
migrations/     schema DDL, run in filename order
seeds/          reference data (roles, a starter department)
scripts/        initDb.js — runs migrations + seeds
```

## Setup

1. **Install MySQL** locally (or use an existing server) and make sure it's
   running on `127.0.0.1:3306` with a `root` user and empty password
   (or update `.env` to match your credentials).

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (OAuth client type: Web application, authorized JS origin
   `http://localhost:5173`). Set `ALLOWED_EMAIL_DOMAIN` to your
   university's email domain, or leave blank to allow any Google account
   during early development.

4. **Initialize the database** (creates the DB, tables, and seed data)
   ```bash
   npm run db:init
   ```

5. **Start the server**
   ```bash
   npm run dev     # with auto-restart (nodemon)
   # or
   npm start       # plain node
   ```

   You should see:
   ```
   Connected to MySQL database "syllabus_tracker" at 127.0.0.1:3306
   Syllabus Tracker API listening on http://localhost:5000
   ```

## Verifying it works

```bash
curl http://localhost:5000/api/v1/health
```
```json
{"success":true,"data":{"status":"ok","uptimeSeconds":3,"timestamp":"...","database":"up"}}
```

## API (Phase 1)

| Method | Endpoint              | Auth        | Description                          |
|--------|-----------------------|-------------|---------------------------------------|
| GET    | `/api/v1/health`       | none        | Liveness + DB connectivity check      |
| POST   | `/api/v1/auth/google`  | none        | Exchange Google ID token for app JWT  |
| GET    | `/api/v1/auth/me`      | Bearer JWT  | Get the current authenticated user    |

All responses follow the shape:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "message": "...", "details": [...] } }
```

## Database schema (Phase 1)

- **roles** — `student`, `faculty`, `cc`, `hod` (seeded)
- **departments** — reference table, seeded with one starter department
- **users** — linked to `roles` and `departments` via foreign keys;
  identity anchored on Google's `sub` (`google_id`), not a password

New users authenticating for the first time are auto-provisioned with
the `student` role. Promoting someone to faculty/CC/HOD is a manual
DB update in Phase 1 — an admin UI for role management is a Phase 2+
feature.

## Notes

- Never commit `.env` — only `.env.example` is tracked.
- All SQL goes through `mysql2`'s parameterized queries (no string
  concatenation), so this is already protected against SQL injection.
- No business/syllabus features are implemented yet — this phase is
  scaffolding only, per the Phase 1 brief.
