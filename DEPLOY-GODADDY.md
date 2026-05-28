# Deploying to GoDaddy Node.js Hosting

This document walks through deploying the kule-epicarmyBuilder API to GoDaddy
Node.js Hosting — a managed PaaS that handles SSL, CDN, and process management
automatically. This is **not** the old cPanel "Setup Node.js App" flow.

Be warned: first attempts may fail. The troubleshooting section at the bottom
covers the most common failure modes.

---

## Prerequisites

- GoDaddy Node.js Hosting plan
- Local Node.js 20+ and npm installed for building
- A domain or the platform-provided preview URL

---

## Deploy workflow

```bash
npm install                      # local, once (installs dev deps for the build)
npm run deploy:zip               # produces deploy/kule-armybuilder.zip
# upload via GoDaddy Node.js Hosting UI
# set env vars in the platform UI
# wait for npm install to finish
# preview URL appears; verify /healthz
# publish to production when satisfied
```

---

## 1. Build the deploy zip

From the repo root on your local machine:

```bash
npm install
npm run deploy:zip
```

This runs five steps:
1. Compiles `apps/api` TypeScript → `apps/api/dist/` (with migrations)
2. Stages `dist/` and `war/` at a flat root (no monorepo structure)
3. Generates a standalone `package.json` from `apps/api/package.json`
   (production `dependencies` only, with a `start: node dist/index.js` script)
4. Regenerates `package-lock.json` scoped to the standalone deps
5. Zips everything into `deploy/kule-armybuilder.zip`

The zip structure is flat — a single standalone app, not a monorepo:

```
<extracted>/
├── package.json           (standalone — start script + dependencies only)
├── package-lock.json      (scoped to standalone deps)
├── dist/                  (compiled JS + db/migrations/)
└── war/                   (static UI directory)
```

Expected output ends with something like:

```
Wrote .../deploy/kule-armybuilder.zip (X.XX MB)
```

---

## 2. Upload and configure via the Node.js Hosting UI

1. Log into your GoDaddy account and navigate to **Node.js Hosting**
2. Open your app (or create a new one)
3. Upload `deploy/kule-armybuilder.zip` through the **Upload** button in the UI
4. The platform extracts the zip automatically

The platform will then run:

```
npm install --production
npm start
```

`npm install --production` installs only `dependencies` (not `devDependencies`).
The TypeScript toolchain (`tsx`, `typescript`) is in `devDependencies` and is
NOT available on the server — that's intentional. We pre-build locally and ship
`dist/` so there is nothing to compile on the server.

---

## 3. Set environment variables

In the Node.js Hosting UI, configure these environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `./data/prod.db` |
| `SESSION_SECRET` | A 32+ byte random string. Generate: `openssl rand -base64 32` |
| `BASE_URL` | The preview URL (e.g. `https://preview-xxxx.godaddy.com`) or your production domain |
| `RESEND_API_KEY` | Your Resend API key (required for magic-link email; set after S2.6) |
| `EMAIL_FROM` | `onboarding@resend.dev` while testing; `auth@yourdomain.com` in production |

`PORT` is provided automatically by the platform — do not set it.

---

## 4. Verify the preview environment

Once the platform finishes `npm install` and starts the app, a private preview
URL will appear in the Node.js Hosting UI. Open:

```
https://<preview-url>/healthz
```

You should see:

```json
{"status":"ok"}
```

If you get a 503 or blank page, check the troubleshooting section below.

Once the preview looks good, click **Publish to Production** and connect your
custom domain through the UI.

---

## 5. Subsequent deploys

Re-deploys follow the same flow:

1. `npm run deploy:zip` locally
2. Upload the new zip via the Node.js Hosting UI
3. The platform re-runs `npm install --production` and restarts the app

The SQLite database at `./data/prod.db` is NOT included in the zip, so it
persists across deploys. The platform preserves the application directory
between deploys.

---

## Troubleshooting

### `better-sqlite3` fails to build during npm install

This is the most likely first-deploy failure. The `better-sqlite3` package
includes a native addon. If the platform's Node.js version has no prebuilt
binary, it tries to compile from source, which requires `node-gyp` and build
tools that may not be present on the server.

**Fix (Phase 2):** Migrate from SQLite to the managed MySQL database that
GoDaddy Node.js Hosting provisions automatically. The platform injects
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` as environment
variables. Switch the data layer to `mysql2` and remove `better-sqlite3`
from `dependencies`.

### App won't start

- Check that `dist/index.js` exists inside the zip:
  `unzip -l deploy/kule-armybuilder.zip | grep dist/index.js`
- Confirm the `start` script in the zip's `package.json` is `node dist/index.js`
- Check the platform logs in the Node.js Hosting UI

### Port errors

The app already binds to `process.env.PORT || 3000`. The platform sets `PORT`
automatically, so this should not be an issue. Never hardcode a port number.

### Missing modules

- Confirm all runtime packages are in `dependencies` (not `devDependencies`)
  in `apps/api/package.json`
- `npm install --production` skips `devDependencies` — if a package needed
  at runtime lives there, move it to `dependencies`

### Magic-link emails not sending

- Confirm `RESEND_API_KEY` is set in the platform UI
- GoDaddy Node.js Hosting allows outbound HTTPS (port 443), which is what the
  Resend SDK uses. If calls to `api.resend.com` still fail, contact GoDaddy
  support to confirm outbound HTTPS is permitted from your container.

### SQLite locking errors under load

The platform may spin up more than one Node.js process. SQLite WAL mode handles
concurrent reads well, but concurrent writes from multiple processes will produce
`SQLITE_BUSY` errors. If you see these in production, the fix is Phase 2:
migrate to the managed MySQL database.

---

## What is NOT in the deploy zip

The following are intentionally excluded:

- `node_modules/` — the platform runs `npm install --production` on the server
- `.git/`, `.claude/` — development tooling
- `apps/api/src/` — TypeScript source; only compiled `dist/` is needed
- `*.db`, `.env*` — database and secrets stay on the server
- `docs/`, `schemas/`, `tools/` — not required at runtime
- `devDependencies` — the build toolchain (`tsx`, `typescript`, etc.) is not
  installed on the server; pre-build locally and ship `dist/`
