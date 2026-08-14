# Deployment Guide

Deploy the Dynamic QR SaaS to production using:

- **GitHub** – source code hosting
- **Neon** – free hosted PostgreSQL
- **Azure App Service** – Node.js backend (`getyourdynamicqr-api`)
- **Vercel** – Angular frontend

> This repository already ships a GitHub Actions workflow
> (`.github/workflows/main_getyourdynamicqr-api.yml`) that deploys the backend to
> Azure Web App on every push to `main`. The backend is live at:
> `https://getyourdynamicqr-api-c9d2g0dsczfjenc0.francecentral-01.azurewebsites.net`

> You must create your own free accounts at the four services. This guide
> assumes you start with no accounts. URLs marked `YOUR-...` are placeholders
> you replace with values the platforms give you.

## Architecture

```
Browser
  │  (HTTPS)
  ├── Vercel  (Angular SPA, static files)
  │      └── API_URL = https://dynamic-qr-api.onrender.com   (env)
  │
  └── Render  (Node/Express backend)
            │  DATABASE_URL (Prisma 7 + pg driver adapter)
            └── Neon       (PostgreSQL)
```

Three URLs you end up with:

| Piece     | Example URL                    |
|-----------|--------------------------------|
| Frontend  | `https://your-app.vercel.app`  |
| Backend   | `https://dynamic-qr-api.onrender.com` |
| Database  | `postgresql://...neon.tech/dynamic_qr?sslmode=require` |

## Step 1 – Firewall secrets and push the code to GitHub

Enable the pre-commit guard so secret-like files can never be committed:

```bash
cd ~/Desktop/bla..bla/getyourdynamicqr
git config core.hooksPath .githooks   # activates .githooks/pre-commit
```

`.gitignore` already excludes `node_modules`, `.env`, `generated/` and `dist/`.
If the repository has no commit yet, create the initial commit (otherwise,
commit the current MVP work):

```bash
git add .
git commit -m "Initial commit: Dynamic QR SaaS (Express + Prisma + Angular)"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dynamic-qr.git
git push -u origin main
```

The hook refuses to commit any `.env`-style or credential/key file; if it
blocks something, add that path to `.gitignore` and run `git rm --cached <file>`.
Note: `core.hooksPath` is a per-clone setting — run the `git config` line again
after cloning the repo on any new machine.

## Tests (run before deploying)

The backend ships with an automated test suite that runs against an isolated
`dynamic_qr_test` database and never touches your development data:

```bash
cd backend
npm test
```

- `pretest` auto-creates `dynamic_qr_test` (if your Postgres role has
  `CREATEDB`) and applies all migrations to it.
- The suite covers auth, QR lifecycle + plan limits, the redirect engine on
  both default and custom hosts, analytics, custom domains, InstaPay billing,
  and rate limiting.

## Step 2 – Create the Neon Postgres database

1. Sign up at https://console.neon.tech/ and create a project (any name, e.g. `dynamic-qr`).
2. Copy the **connection string**, which looks like:
   `postgresql://neondb_owner:NEONPASSWORD@ep-xxx.us-east-2.aws.neon.tech/dynamic_qr?sslmode=require`
3. If the password contains reserved URI characters (`@`, `:`, `/`, `?`, `#`, `%`), URL-encode them:
   - `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`
   - Keep the `?sslmode=require` at the end — Prisma needs it over TLS.
4. Keep this string; you'll paste it into Render as `DATABASE_URL`.

## Step 3 – Deploy the backend to Render (Web Service)

1. Go to https://dashboard.render.com/ → **New** → **Web Service**.
2. Connect the GitHub repository, branch `main`.
3. Click Root Directory and set it to `backend`.
4. Set the following (values given by Render):

   - **Runtime**: `Node`
   - **Build Command**: `npm install`   *(postinstall runs `prisma generate` automatically)*
   - **Start Command**: `npm start`     *(runs `tsx src/app.js`)*
   - **Region**: nearest to your users (optional).

5. Add environment variables (on Azure App Service: **Configuration → Application settings**):

   | Variable      | Value                                                        |
   |---------------|--------------------------------------------------------------|
   | `DATABASE_URL`| The Neon string from Step 2 **without surrounding quotes**   |
   | `JWT_SECRET`  | A long random string, e.g. from `openssl rand -hex 32`       |
   | `BASE_URL`    | `https://getyourdynamicqr-api-c9d2g0dsczfjenc0.francecentral-01.azurewebsites.net` |
   | `CORS_ORIGINS`| Your frontend origin(s), comma-separated, no spaces          |

   `BASE_URL` is what every QR link is built from. If you leave it unset, the
   app falls back to the Azure `WEBSITE_HOSTNAME` automatically (so QR links are
   still correct), and in production it fails fast if neither is present —
   printed QR codes can never silently point at `localhost`.

   Optional rate-limiting tuning (defaults are sensible — skip if unsure):
   `RATE_LIMIT_API_MAX` (300/15min), `RATE_LIMIT_AUTH_MAX` (5/15min),
   `RATE_LIMIT_REDIRECT_MAX` (120/min).

   Custom domains: set `CUSTOM_DOMAIN_AUTO_VERIFY=false` in production. MVP
   auto-verifies domains on add; with it false, added domains stay unverified
   (an explicit DNS TXT verification is the documented next step before you
   accept live domains). Users must point their domain's DNS at the backend
   (e.g. a CNAME to `dynamic-qr-api.onrender.com`) for redirects to resolve.

   Plans (InstaPay): set `INSTAPAY_WALLET` to your InstaPay mobile number
   (`01XXXXXXXXX`) for plan-upgrade payments. Plans are FREE / PRO / ENTERPRISE
   with QR-count and custom-domain limits enforced server-side. Payment
   confirmation is a self-served MVP flow (user enters their InstaPay
   transaction reference) — reconcile against your bank before going fully live.

6. Click **Create Web Service**. Wait for the first deployment to finish.
7. **Apply the database migrations once** (a one-time step, after the service is live):
   - Render → your service → **Shell** (top right), then run:
     ```bash
     npm run prisma:deploy
     ```
   - You should see: `No pending migrations to apply.` (because the migration is applied now) — on the very first run it applies `20260812152016_init` and creates the tables.
8. Verify: open `https://dynamic-qr-api.onrender.com/health` → expect `{"status":"ok","database":"connected"}`.

> Note: the backend uses Prisma 7's generated **TypeScript client**, run through
> `tsx`. Render installs devDependencies (including `tsx`), then `postinstall`
> regenerates the client, so no compile step is needed.

## Step 4 – Deploy the frontend to Vercel

The frontend needs to know the backend URL. It is baked into the build from
`frontend/src/environments/environment.production.ts`:

```ts
export const environment = {
  production: true,
  apiUrl: 'https://YOUR-BACKEND.onrender.com',   // <- replace this
};
```

1. Edit that file to your real Render URL (from Step 3), then commit and push:
   ```bash
   git add frontend/src/environments/environment.production.ts
   git commit -m "Set production API URL"
   git push
   ```
2. Go to https://vercel.com → **Add New Project** → import the same GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Vercel auto-detects the Angular framework. If it asks, set:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/frontend/browser`
5. Click **Deploy**. Vercel gives you `https://your-app.vercel.app`.

### Client-side routing (deep links) on Vercel

Angular routes like `/login` or `/dashboard` exist only in the browser. A hard
refresh on those URLs returns a Vercel 404 unless rewrites are configured.
Add a `vercel.json` in the `frontend/` folder and re-deploy:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

## Step 5 – Final wiring and end-to-end check

1. Set `CORS_ORIGINS` on Render to your final Vercel domain (Step 3.5) — i.e. `https://your-app.vercel.app` (add `https://www.your-app.vercel.app` if you use `www`).
2. Open the Vercel app, register an account, log in, create a QR code.
3. Scan the displayed QR with a phone, or open the `redirectUrl` it shows — it must 302 to your destination and count a scan.
4. Open the QR's Analytics page: total/today/week counts and recent scans should update.

## Troubleshooting

- **`/health` says `database: "disconnected"`** → check `DATABASE_URL`: no surrounding quotes, `@`-chars URL-encoded, `?sslmode=require` present. Redeploy after fixing.
- **Frontend requests get CORS errors** → `CORS_ORIGINS` on Render must contain the exact frontend origin (protocol + host, no trailing slash).
- **`prisma migrate deploy` fails** → export the Render env vars in the Shell first (`echo $DATABASE_URL`), confirm it points to Neon, then retry.
- **404 on `/login` refresh** → add `vercel.json` rewrites (Step 4) and redeploy the frontend.
- **QR image points at `localhost:3000`** → `BASE_URL` (or Azure `WEBSITE_HOSTNAME`) is missing on the backend; set it to the real backend URL and redeploy.
- **QR card shows "Needs check"** → run the card's **Verify** button (calls `GET /api/qr/:id/health`) or re-create the QR. A healthy QR passes all four checks: production-safe redirect URL, generated image, reachable redirect endpoint, and redirect resolving to the destination.

## Security checklist

- Use a long, unique `JWT_SECRET` (generate with `openssl rand -hex 32`). Never reuse the dev `some-secret`.
- Neon: rotate the database password; limit who has project access.
- Render free tier sleeps after inactivity (first request is slow) — acceptable for MVP.
- MVP limitation (documented): the JWT lives in `localStorage`; switch to httpOnly cookies for higher-security installs.