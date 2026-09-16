# Syllabus Tracker — Frontend (Phase 1)

React + Vite SPA. Google OAuth login, role-based routing, and
placeholder dashboards for Student, Faculty, CC and HOD.

## Structure

```
src/
  api/          axios client + API modules (authApi, healthApi)
  context/      AuthContext (session, login, logout)
  components/
    layout/     Sidebar, Navbar, PageContainer, Layout (app shell)
    common/     Loading, ErrorState, EmptyState
  pages/
    auth/       Login page (Google Sign-In button)
    dashboards/ StudentDashboard, FacultyDashboard, CCDashboard, HODDashboard
  routes/       AppRoutes, ProtectedRoute, RoleHomeRedirect
  styles/       theme.css (design tokens), global.css (base + primitives)
```

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Set `VITE_GOOGLE_CLIENT_ID` to the **same** Google OAuth client ID
   used in the backend `.env`. Set `VITE_API_BASE_URL` if your backend
   isn't running on the default `http://localhost:5000`.

3. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:5173

4. **Production build**
   ```bash
   npm run build   # outputs to dist/
   npm run preview # preview the production build locally
   ```

## How auth flows

1. User clicks the Google Sign-In button on `/login`.
2. Google returns an ID token to the frontend.
3. Frontend POSTs it to `POST /api/v1/auth/google` on the backend.
4. Backend verifies the token with Google, finds/creates the user
   (default role: `student`), and returns an app JWT + user profile.
5. Frontend stores the JWT in `localStorage` and attaches it to every
   subsequent API request via an axios interceptor.
6. `ProtectedRoute` reads the user's role from `AuthContext` and routes
   them to `/student`, `/faculty`, `/cc`, or `/hod` accordingly.

## Theme

Colors live in `src/styles/theme.css` as CSS variables (primary teal
`#00A9B4`, dark teal `#00838C`, etc.) — inspired by, not copied from,
the Marwadi University dashboard look. Change the palette in one place
and it propagates everywhere.

## Responsiveness

The sidebar collapses to an icon rail on desktop and becomes an
off-canvas drawer (triggered by the navbar's menu button) below 768px.
Layout, cards, and forms use fluid widths and adjusted padding at
1024px and 768px breakpoints.

## Notes

- No business/syllabus features are implemented yet — dashboards are
  placeholders (`EmptyState`) per the Phase 1 brief. Phase 2 replaces
  their contents without touching routing, auth, or layout.
