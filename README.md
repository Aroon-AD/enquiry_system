# Project Enquiry Management System

A full-stack system for capturing customer project enquiries and managing them through an authenticated admin console — built on Node.js/Express and MongoDB.

## What's included

- **Public enquiry form** (`frontend/public/index.html`) — responsive, client- and server-validated, supports file attachments.
- **Admin dashboard** (`frontend/admin/index.html`) — JWT-authenticated console with overview stats, search/filter/paginated enquiry list, status & priority management, internal notes, attachment downloads, and a full audit trail per enquiry.
- **Backend API** (`backend/`) — Express REST API backed by MongoDB (Mongoose), with:
  - JWT authentication, bcrypt password hashing, account lockout after repeated failed logins
  - Role-based access control (`admin` vs `superadmin`)
  - Full audit logging (every status change, assignment, note edit, view, download, and login is recorded)
  - Search (MongoDB text index), filtering (status/priority/project type/date range), sorting, and pagination
  - Secure file uploads (type/size allow-listing, randomized filenames, path-traversal guards, auth-gated downloads)
  - Security hardening: Helmet, CORS allow-list, NoSQL-injection sanitization, XSS stripping, HTTP parameter pollution protection, tiered rate limiting
  - Performance: gzip compression, MongoDB compound/text indexes, connection pooling, `lean()` reads, parallelized queries

## Architecture

```
enquiry-system/
├── backend/                 Express API
│   ├── config/db.js         MongoDB connection (pooled, retrying)
│   ├── models/               Enquiry, Admin, AuditLog, Counter
│   ├── middleware/           auth, validators, rate limiting, upload, sanitize, errors
│   ├── controllers/          business logic
│   ├── routes/                route wiring
│   ├── utils/                 logger, admin seed script
│   └── server.js
├── frontend/
│   ├── public/index.html     customer enquiry form
│   └── admin/                admin dashboard (SPA, vanilla JS)
├── docker-compose.yml         backend + MongoDB + static frontend server
└── README.md
```

## Quick start (Docker — recommended)

1. Copy the environment template and set real secrets:
   ```bash
   cp backend/.env.example backend/.env
   ```
   At minimum, change `JWT_SECRET` to a long random string and set a strong `SEED_ADMIN_PASSWORD`.

2. Start everything:
   ```bash
   docker compose up --build -d
   ```
   This starts MongoDB, the API (port `5000`), and the frontend (port `8080`) via Nginx.

3. Create the first admin account:
   ```bash
   docker compose exec backend npm run seed:admin
   ```

4. Open:
   - Customer form: http://localhost:8080/public/
   - Admin console: http://localhost:8080/admin/ (log in with the seeded email/password)

## Quick start (without Docker)

Requires Node.js 18+ and a running MongoDB instance (local or Atlas).

```bash
cd backend
cp .env.example .env    # edit MONGO_URI, JWT_SECRET, SEED_ADMIN_* values
npm install
npm run seed:admin      # creates the first superadmin
npm run dev              # starts on http://localhost:5000
```

Then serve `frontend/public/index.html` and `frontend/admin/index.html` with any static file server (or open directly in a browser — they call the API at `http://localhost:5000/api` by default). To point them at a different API host, set `window.ENQUIRY_API_BASE` before the script tag, e.g.:
```html
<script>window.ENQUIRY_API_BASE = "https://api.yourdomain.com/api";</script>
```

## Deploying to production

- **Database**: use MongoDB Atlas or a managed MongoDB instance; set `MONGO_URI` accordingly. Enable Atlas network/IP allow-listing.
- **Backend**: deploy the `backend/` Docker image to any container host (Render, Fly.io, ECS, a VPS with `docker compose`, etc.). Put it behind HTTPS (a reverse proxy like Nginx/Caddy, or your host's managed TLS).
- **Frontend**: the two HTML/CSS/JS bundles are fully static — deploy them to any static host (Netlify, Vercel, S3+CloudFront, or the same Nginx box) and set `CLIENT_ORIGIN` in the backend `.env` to that origin for CORS.
- **Secrets**: never commit `.env`. Rotate `JWT_SECRET` and the seeded admin password immediately after first login.
- **Uploads**: the `uploads/` volume is local disk by default. For multi-instance deployments, swap to S3-compatible object storage (swap the `multer` disk storage engine for `multer-s3` or similar — the rest of the attachment model already stores metadata generically).

## API reference

All authenticated routes require `Authorization: Bearer <token>`.

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/enquiries` | Public (rate-limited) | Submit a new enquiry (multipart/form-data, up to 3 attachments) |
| GET | `/api/enquiries` | Admin | List enquiries — `?search=&status=&priority=&projectType=&dateFrom=&dateTo=&sortBy=&sortOrder=&page=&limit=` |
| GET | `/api/enquiries/stats/summary` | Admin | Dashboard counts by status/priority |
| GET | `/api/enquiries/:id` | Admin | Get one enquiry (also logs an `ENQUIRY_VIEWED` audit event) |
| PATCH | `/api/enquiries/:id/status` | Admin | Change status (`New`, `In Progress`, `On Hold`, `Resolved`, `Closed`) |
| PATCH | `/api/enquiries/:id/priority` | Admin | Change priority (`Low`, `Medium`, `High`, `Urgent`) |
| PATCH | `/api/enquiries/:id/assign` | Admin | Assign/unassign to an admin user |
| PATCH | `/api/enquiries/:id/notes` | Admin | Update internal notes |
| DELETE | `/api/enquiries/:id` | Superadmin only | Soft-delete an enquiry |
| GET | `/api/enquiries/:id/attachments/:storedName` | Admin | Download an attachment |
| POST | `/api/auth/login` | Public (rate-limited) | Log in, returns JWT |
| GET | `/api/auth/me` | Admin | Current admin profile |
| GET | `/api/audit-logs` | Admin | List audit events — `?enquiryId=&action=&page=&limit=` |
| GET | `/api/health` | Public | Liveness check |

## Security controls implemented

- Password hashing with bcrypt (configurable salt rounds)
- JWT-based auth with expiry; account lockout after 5 failed logins (15-minute cooldown)
- Role-based authorization (delete restricted to `superadmin`)
- Helmet security headers, strict CORS origin allow-list
- express-mongo-sanitize (NoSQL injection), hpp (parameter pollution), custom XSS stripping on all string input
- express-validator on every mutating route (server never trusts client-side validation alone)
- File upload allow-list by MIME type + extension, randomized storage filenames, path-traversal guard on download, size/count limits
- Tiered rate limiting: strict on public submission and login, looser on general authenticated API traffic
- Full audit trail: every state change and sensitive read (view, download, login/login failure) is recorded with actor, timestamp, IP, and before/after values

## Performance optimizations

- MongoDB indexes: text index across searchable fields, compound index on `(status, priority, createdAt)`, single-field indexes on frequently filtered fields
- Connection pooling (`maxPoolSize`) with automatic reconnect/retry
- `.lean()` on read-heavy list/detail queries to skip Mongoose document overhead
- Parallelized independent queries (`Promise.all` for count + find, and for dashboard aggregates)
- Gzip response compression
- Pagination enforced server-side (max 100 rows/page) to prevent unbounded result sets

## Notes & suggested next steps

- The admin dashboard stores its JWT in `localStorage` for simplicity. For higher security in production, consider an httpOnly cookie-based session instead (would require adding CSRF protection).
- Add automated tests (Jest + Supertest) for the controllers if this moves toward a team codebase — the current build was manually smoke-tested (server boot, health check, and full syntax validation of every file) in this environment, which has no outbound access to a MongoDB service to run live integration tests. Docker Compose above will let you run the full stack, including MongoDB, in one command.
