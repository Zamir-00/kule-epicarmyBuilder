# Deploying to GoDaddy Web Hosting Deluxe

This document walks through deploying the kule-epicarmyBuilder API to GoDaddy
Web Hosting Deluxe using cPanel's "Setup Node.js App" feature.

Be warned: first attempts may fail. The troubleshooting section at the bottom
covers the most common failure modes.

---

## Prerequisites

- GoDaddy Web Hosting Deluxe plan (or higher) with cPanel access
- Node.js 20.x available in "Setup Node.js App" (see note below if it isn't)
- A domain or subdomain pointed at the hosting account
- Local Node.js 20+ and npm installed for building

---

## 1. One-time setup in cPanel

### Open "Setup Node.js App"

Log into cPanel, find **Setup Node.js App**, and click **Create Application**.

### Configure the application

| Field | Value |
|---|---|
| Node.js version | **20.x** (use 18.x if 20 isn't listed — avoid 16.x; `better-sqlite3` prebuilts may not exist) |
| Application mode | Production |
| Application root | `kule-armybuilder` (a directory under your cPanel home, e.g. `/home/youruser/kule-armybuilder`) |
| Application URL | Your domain or a subdirectory, e.g. `yourdomain.com` or `yourdomain.com/app` |
| Application startup file | `apps/api/dist/index.js` |

Click **Create**. GoDaddy will configure Passenger to serve the app.

### Set environment variables

Still in the Setup Node.js App panel, add these variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `./data/prod.db` (relative to the Application Root; GoDaddy typically sets `cwd` to the app root — if you get "permission denied" errors, use the absolute path, e.g. `/home/youruser/kule-armybuilder/data/prod.db`) |
| `SESSION_SECRET` | A 32+ byte random string. Generate one with: `openssl rand -hex 32` |
| `BASE_URL` | `https://yourdomain.com` (the public URL, no trailing slash) |
| `RESEND_API_KEY` | Your Resend API key (set once you have one; required for magic-link email) |
| `EMAIL_FROM` | `auth@yourdomain.com` — or `onboarding@resend.dev` while testing (Resend's shared domain) |

---

## 2. Build and upload

On your local machine, from the repo root:

```bash
# Install dependencies (if you haven't recently)
npm install

# Build the API and produce the deploy zip
npm run deploy:zip
```

This runs two steps:
1. Compiles `apps/api` TypeScript → `apps/api/dist/`
2. Stages and zips: `package.json`, `package-lock.json`, `apps/api/package.json`,
   `apps/api/dist/`, and `war/` into `deploy/kule-armybuilder.zip`

Expected output ends with something like:
```
Wrote .../deploy/kule-armybuilder.zip (3.2 MB)
```

### Upload the zip

1. In cPanel, open **File Manager**
2. Navigate to your Application Root (`/home/youruser/kule-armybuilder`)
3. Click **Upload** and upload `deploy/kule-armybuilder.zip`
4. Select the zip in File Manager and click **Extract** — extract into the current directory (the app root)
5. Confirm it extracted correctly: you should see `package.json`, `apps/`, `war/` at the top level of the app root

---

## 3. Install dependencies on the server

Back in **Setup Node.js App**, click **Run NPM Install**.

This can take several minutes. `better-sqlite3` includes a native addon that
must compile against the server's Node.js version. Watch for errors in the
cPanel log panel — a successful run ends with something like `added N packages`.

---

## 4. Start the app

In Setup Node.js App, click **Restart** (or **Start** if it hasn't run yet).

To verify it's working, visit:

```
https://yourdomain.com/healthz
```

You should see:

```json
{"status":"ok"}
```

If you see a 503 or blank page, check the troubleshooting section below.

---

## 5. Subsequent deploys

Re-deploys follow the same flow:

1. `npm run deploy:zip` locally
2. Upload and extract the zip in File Manager (overwrite existing files)
3. **Run NPM Install** (only needed if `package-lock.json` changed)
4. **Restart** the app

The database at `./data/prod.db` is NOT included in the zip, so it persists
across deploys. GoDaddy preserves the application directory between deploys.

---

## Troubleshooting

### `better-sqlite3` fails to compile during npm install

This is the most likely first-deploy failure. Causes:

- **Wrong Node.js version**: `better-sqlite3` ships prebuilt binaries for
  common Node versions. If your selected version has no prebuilt, it tries to
  compile from source, which requires `node-gyp` and build tools that GoDaddy
  may not provide. Try switching to Node 20.x or 18.x LTS in Setup Node.js App.
- **Out of memory during compile**: Shared hosting sometimes OOMs during native
  builds. There is no good workaround short of upgrading your plan or switching
  to a database that doesn't require native binaries (Phase 2: MySQL).

### Permission denied writing `./data/prod.db`

Passenger may set the working directory to something other than the app root.
If `./data/prod.db` fails, set `DATABASE_PATH` to the full absolute path:

```
/home/youruser/kule-armybuilder/data/prod.db
```

The app will create the `data/` directory automatically on first start if it
doesn't exist.

### 503 / app won't start

- Check cPanel error logs (usually in `~/logs/` or the Errors section of cPanel)
- Confirm the startup file is `apps/api/dist/index.js` (not `index.js` at root)
- Confirm the build step ran successfully — `apps/api/dist/index.js` must exist
  in the uploaded zip

### Magic-link emails not sending

- Confirm `RESEND_API_KEY` is set in Setup Node.js App environment variables
- GoDaddy's shared hosting may block outbound SMTP but HTTPS to `api.resend.com`
  should be allowed. If Resend HTTPS calls fail, contact GoDaddy support to
  confirm outbound HTTPS on port 443 is permitted.

### SQLite locking errors under load (multiple Passenger workers)

GoDaddy's Passenger may spin up more than one Node.js process. SQLite WAL mode
handles concurrent reads well, but concurrent writes from multiple processes
will produce `SQLITE_BUSY` errors.

If you see these in production, the fix is Phase 2: migrate to MySQL
(GoDaddy Deluxe includes MySQL). WAL mode and low traffic may let you run for
a while without hitting this, so try it first.

---

## What is NOT in the deploy zip

The following are intentionally excluded (handled differently or not needed at runtime):

- `node_modules/` — GoDaddy runs `npm install` on the server
- `.git/`, `.claude/` — development tooling
- `apps/api/src/` — TypeScript source; only compiled `dist/` is needed
- `*.db`, `.env*` — database and secrets stay on the server
- `docs/`, `schemas/`, `tools/` — not required at runtime
