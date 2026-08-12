# Features Implemented

This file lists every feature that is implemented and working in the Dynamic QR SaaS project.
It tracks the live state of the codebase — if something is listed here, it is built, wired in, and tested locally.

> Status: all MVP features (Phases 1–9) plus the Phase 10 production config and the
> Phase 11 hardening/billing features are complete. The backend runs locally on
> `http://localhost:3000`; the frontend dev server runs on `http://localhost:4200`.

---

## 1. Backend — Authentication

- **Register** (`POST /api/auth/register`)
  - Validates email format and password length (min 8 chars).
  - Returns `409` if the email already exists.
  - Hashes the password with **bcrypt** (10 rounds); `passwordHash` is never returned.
- **Login** (`POST /api/auth/login`)
  - Verifies credentials; returns a signed **JWT** (7-day expiry) plus basic user info.
  - JWT payload is minimal and non-sensitive (`{ userId }` only).
- **Auth middleware** (`authenticate`)
  - Reads `Authorization: Bearer <token>`, verifies the JWT, attaches `req.user`.
  - Rejects missing/invalid tokens with `401`.
- **Endpoint** `GET /api/auth/me` — returns the current user for a valid token.

Files: `services/auth.service.js`, `middleware/auth.middleware.js`, `utils/jwt.js`.

---

## 2. Backend — QR Code Lifecycle

All QR endpoints are protected (JWT required).

- **Create** (`POST /api/qr`)
  - Validates title (1–100 chars) and destination URL (must be a valid http(s) URL).
  - Generates a unique 6-character short code (collision-safe with retry).
  - Generates a QR image that encodes **our redirect URL** (`http://localhost:3000/q/CODE`),
    never the user's destination (spec §32).
  - Enforces the user's **plan limit** on the number of QR codes (`403` when exceeded).
- **List** (`GET /api/qr`) — returns the user's own non-deleted QR codes, newest first, each with `scanCount`.
- **Get one** (`GET /api/qr/:id`).
- **Update** (`PATCH /api/qr/:id`) — `title`, `destinationUrl`, `isActive`, `designConfig`, `domainId`.
  - Changing the destination **never changes the short code**; the printed QR stays valid.
- **Soft delete** (`DELETE /api/qr/:id`) — sets `deletedAt`; the record stays but stops redirecting.
- **Ownership**: a user can only access their own QR codes (others get `404`, not `403`, to avoid ID enumeration).

Files: `services/qr.service.js`, `controllers/qr.controller.js`, `utils/shortCode.js`.

### QR image generation
- Uses the `qrcode` package; returns a PNG data URL.
- The encoded URL is the redirect link (default or custom domain), so re-printing is never required when destinations change.

---

## 3. Backend — Redirect Engine (the core feature)

- **`GET /q/:shortCode`** (public, no auth)
  1. Look up the QR code by short code.
  2. Ignore soft-deleted and inactive codes → `404`.
  3. Record a scan event (best-effort — a logging failure never blocks the redirect).
  4. Redirect with **HTTP 302** (temporary) — NOT 301, so every scan reaches our server again.

- **Custom-domain routing**: when the request host is not our default host, the backend
  resolves the domain to its owner and only serves that owner's QR codes (`findForRedirectOnDomain`).

Files: `controllers/redirect.controller.js`, `services/qr.service.js`.

---

## 4. Backend — Scan Analytics

- **`GET /api/qr/:id/analytics`** (protected, ownership-checked) returns:
  - `totalScans`, `scansToday`, `scansThisWeek`.
  - `scansByDate` — per-day counts for the last 14 days (0-filled).
  - `devices`, `operatingSystems`, `browsers` — breakdowns with counts, sorted desc.
  - `recentScans` — the 10 most recent scan events.
- Scan events capture IP, user agent, and — since the analytics upgrade —
  **device type, OS, and browser** parsed from the user agent via `ua-parser-js`.

Try it:

```bash
curl -X GET http://localhost:3000/api/qr/<QR_ID>/analytics \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 5. Backend — Custom Domains

- **Manage domains** (protected routes)
  - `POST /api/domains` — add a domain (validates format, normalizes to lowercase, enforces plan: paid plans only → `403` on Free).
  - `GET /api/domains` — list own domains.
  - `DELETE /api/domains/:id` — remove a domain; QRs using it fall back to the default host.
- **Verification**: a `isVerified` flag gates whether the domain redirects. In dev this is
  auto-verified (`CUSTOM_DOMAIN_AUTO_VERIFY=true`); in production set it to `false` and
  verify the domain (e.g. DNS TXT record — documented as a next step) before enabling.
- **Per-QR domain choice**: creating/editing a QR can pick one of the user's verified domains
  (`domainId`), so the printable link becomes `https://my-domain.com/q/CODE`.

Try it locally (host-header trick, no DNS needed):

```bash
curl -H "Host: qr.localhost" http://localhost:3000/q/<CODE>   # → 302 to destination
```

Files: `services/domains.service.js`, `controllers/domains.controller.js`, `routes/domains.routes.js`.

---

## 6. Backend — Plans & InstaPay Billing

> Stripe is intentionally not used because it is unavailable in Egypt; payments use **InstaPay**.

- **Plans**
  - `FREE` — 3 QR codes, no custom domains, EGP 0.
  - `PRO` — 50 QR codes, custom domains, EGP 250/month.
  - `ENTERPRISE` — unlimited QR codes, custom domains, EGP 1000/month.
  - Limits are enforced server-side when creating QR codes / custom domains (`403`).
- **InstaPay payment flow**
  1. `POST /api/billing/instapay { planType }` → creates a payment order with a unique
     reference (e.g. `DQR-8ED66DF9`), the plan price in EGP, and the merchant wallet.
  2. The user pays the wallet in their InstaPay app using the reference.
  3. `POST /api/billing/confirm { paymentId, instapayRef }` → marks the payment `PAID` and
     upgrades the user's `planType`. (MVP is self-served; a real deployment would reconcile
     with the bank before upgrading.)
- **`GET /api/billing/plan`** — returns the current plan + all plan options + wallet number.

Files: `services/billing.service.js`, `controllers/billing.controller.js`, `routes/billing.routes.js`, `config/plans.js`, `utils/instapay.js`.

---

## 7. Backend — Rate Limiting & Abuse Protection

- Uses `express-rate-limit` with in-memory per-IP counters (env-tunable):
  - `apiLimiter` — 300 requests / 15 min across all `/api` routes.
  - `authLimiter` — 5 attempts / 15 min on register + login (brute-force protection).
  - `redirectLimiter` — 120 / min on `/q/*` (generous, so many people scanning one printed QR still works).
- Exceeding a limit returns **HTTP 429** with standard `RateLimit-*` / `Retry-After` headers.
- `app.set("trust proxy", 1)` so client IPs are correct behind Render/Vercel proxies.

Try it:

```bash
for i in 1 2 3 4 5 6; do
  curl -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" -d '{"email":"x@y.com","password":"wrong"}'
done   # 6th call → 429
```

Files: `middleware/rateLimit.js`, wired into `app.js`, `auth.routes.js`, `redirect.routes.js`.

---

## 8. Backend — Cross-Cutting

- **Consistent API responses**: `{ success: true, data }` / `{ success: false, message }`.
- **Central error handler** — maps errors to proper HTTP codes; never leaks raw DB errors.
- **CORS** — configurable via `CORS_ORIGINS` env var (allow-all in dev, restricted in production).
- **Environment configuration** — all settings via `.env` / `.env.example`; secrets are never committed.
- **Health check** `GET /health` — verifies the database connection is live.

---

## 9. Frontend (Angular)

- **Pages**
  - Login (`/login`) and Register (`/register`).
  - Dashboard (`/dashboard`) — QR list with status, scans, actions (enable/disable, edit, analytics, delete), plan badge.
  - QR create (`/qr/create`) — form + generated QR preview.
  - QR edit (`/qr/:id/edit`) — edit destination/title/state/domain without regenerating the QR.
  - QR analytics (`/qr/:id/analytics`) — stat cards, 14-day bar chart, device/OS/browser tables, recent scans.
  - Custom domains (`/domains`) — add/remove domains with verified status.
  - Plans (`/plans`) — plan cards + InstaPay payment panel (wallet, amount, reference, confirm).
- **Services**: `auth`, `qr`, `domain`, `billing`, environment-driven `API_URL`.
- **Plumbing**: auth guard, HTTP interceptor (attaches Bearer token), `qr-image` component for client-side QR rendering (also used to show the payment QR).
- **Environment split**: `environment.ts` (dev, `http://localhost:3000`) vs
  `environment.production.ts` (set `apiUrl` to your deployed backend) via `angular.json` file replacements.

---

## 10. Data Model

| Model | Purpose | Key notes |
|---|---|---|
| `User` | Account | `email` unique, `passwordHash` (bcrypt), `planType` (FREE/PRO/ENTERPRISE) |
| `QRCode` | One dynamic QR | `shortCode` unique + indexed, `destinationUrl`, `isActive`, `domainId?` (custom domain), `deletedAt` (soft delete) |
| `ScanEvent` | One scan | `ipAddress`, `userAgent`, `deviceType`, `os`, `browser`; index on `(qrCodeId, scannedAt DESC)` |
| `CustomDomain` | User's own domain | `domain` unique, `isVerified`; deleting falls QRs back to default host |
| `Payment` | InstaPay order | `reference` unique, `planType`, `amountEGP`, `status` (PENDING/PAID) |

Relations: `User 1—N QRCode 1—N ScanEvent`; `User 1—N CustomDomain 1—N QRCode`; `User 1—N Payment`.
Cascade deletes: user → QR codes/domains/payments; QR code → scan events.

**Migrations (applied)**
- `20260812152016_init` — initial schema (User, QRCode, ScanEvent).
- `20260812163717_add_custom_domains` — CustomDomain + `QRCode.domainId`.
- `20260812164618_add_instapay_payments` — Payment.

---

## 11. REST API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | – | API banner |
| GET | `/health` | – | Database health check |
| POST | `/api/auth/register` | – | Register a new user |
| POST | `/api/auth/login` | – | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Current user |
| POST | `/api/qr` | JWT | Create a QR code |
| GET | `/api/qr` | JWT | List own QRs |
| GET | `/api/qr/:id` | JWT | Get one QR |
| PATCH | `/api/qr/:id` | JWT | Update title/destination/active/domain |
| DELETE | `/api/qr/:id` | JWT | Soft-delete a QR |
| GET | `/api/qr/:id/analytics` | JWT | Analytics for a QR |
| GET | `/q/:shortCode` | – | Public redirect (302) + scan logging |
| POST | `/api/domains` | JWT | Add a custom domain |
| GET | `/api/domains` | JWT | List own domains |
| DELETE | `/api/domains/:id` | JWT | Remove a domain |
| GET | `/api/billing/plan` | JWT | Current plan + options + wallet |
| POST | `/api/billing/instapay` | JWT | Create an InstaPay payment |
| POST | `/api/billing/confirm` | JWT | Confirm payment, upgrade plan |

---

## 12. Production Readiness

- `DEPLOYMENT.md` covers the full production setup: GitHub → **Neon** (PostgreSQL) →
  **Render** (backend) → **Vercel** (frontend), plus migrations, CORS, and env vars.
- Backend `package.json` includes production scripts:
  - `start` = `tsx src/app.js`
  - `postinstall` = `prisma generate`
  - `prisma:deploy` = `prisma migrate deploy`
- Git is initialized and `.gitignore` is correct (no `.env`, `node_modules/`, `generated/`, `dist/`, or logs committed).

## 12. Automated Tests

The backend includes an automated test suite that runs against an isolated
`dynamic_qr_test` database (never your dev data):

```bash
cd backend
npm test
```

- `pretest` auto-creates `dynamic_qr_test` (needs `CREATEDB`) and applies all
  migrations to it; the suite then exercises the real HTTP API over an ephemeral
  port using Node's built-in test runner (`node:test` + `fetch`) — no extra
  dependencies.
- Coverage: auth (validation, duplicate email, JWT, `/me`), QR lifecycle +
  FREE/ENTERPRISE plan gating, ownership isolation (404s), 302 redirect engine
  incl. soft-delete/inactive toggling, analytics (daily history + device/OS/
  browser breakdowns), custom domains (gating, 409 dupes, host-aware redirect,
  fallback on delete), InstaPay billing (create/confirm/double-confirm/foreign
  404), and rate limiting (429 + `RateLimit-*` headers).
- `src/app.js` only listens when run directly; under tests (`NODE_ENV=test`) it
  is imported and started on a random port.

---

## Out of Scope / Not Implemented (per project.md §28)

Not built (deliberately): Stripe/subscriptions, custom-domain DNS auto-verification,
geo-IP country/city enrichment, teams/roles/permissions, API keys, webhooks, white labeling,
multiple QR types (vCard/PDF), rate-limit shared store (Redis).