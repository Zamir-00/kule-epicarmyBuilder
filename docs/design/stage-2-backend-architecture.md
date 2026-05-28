# Stage 2 — Backend Architecture

**Status:** Decided 2026-05-28. Records eight design decisions plus architecture, data model, coexistence plan, deployment, and the eight stories that close stage 2.
**Stage:** 2 of 4 (per `ROADMAP.md`).
**Builds on:** `docs/design/data-model.md` (stage 1 settled the data shape; stage 2 builds the service that serves it).

## Context

Stage 1 made `war/source-json/*.json` and `war/lists/*.json` clean, schema-validated, and ID'd. The legacy `chooser.html` UI continues to work, reading the files via `Ajax.Request` on a static HTTP server (`python3 -m http.server` locally; GitHub Pages or similar in prod, if deployed).

Stage 2 introduces a real backend service that:

- Serves the same static catalog data over a stable URL with proper cache headers
- Adds user accounts (magic-link sign-in) and persistent saved lists
- Provides shareable list URLs
- Coexists with the legacy UI — no blackouts, per `[[project-users]]` constraint

Stage 3 will replace the legacy UI with a modern SPA that consumes this backend's API. Stage 4 will add a mobile app sharing the same backend.

The decisions below define what stage 2 builds, how it integrates, and what stays out of scope (deferred to later stages or follow-ups).

---

## Decision A — Backend scope

**Decision:** Build a real backend with user accounts, persistent saved lists, and shareable URLs. Not just a static-file API; not collaborative real-time editing.

**Rationale:**

- Pure static-file serving wouldn't justify a backend at all — could keep using GitHub Pages.
- Real-time collab is significant additional scope (WebSockets, CRDTs, presence) for unknown user demand.
- Save-and-share is the smallest set of features that delivers obvious user value over the current localStorage-only experience.

**Out of scope (deferred):**

- Collaborative real-time editing
- Multi-tenant org accounts (only individual users in v1)
- Public list discovery / search
- List versioning / undo history
- Image uploads (army-painted minis)
- Comments / likes / community features

---

## Decision B — Deployment: managed PaaS (Railway recommended)

**Decision:** Deploy to Railway (Render or Fly.io are equivalent alternatives). Long-running Node process, persistent volume for SQLite.

**Rationale:**

- Push-to-deploy DX matches "solo dev + occasional contributors" audience
- ~$5-10/mo total cost (Railway hobby + email + backups storage)
- Persistent volume keeps SQLite simple
- Avoids serverless/edge runtime constraints (cold starts, no long-running processes, no Node-only APIs)

**Alternatives considered:**

- *Serverless / edge (Cloudflare Workers + D1)*: cheapest at low traffic but constrains code (no Node-only APIs, cold-start latency, can't run long-lived processes). Premature for this scale.
- *Self-hosted VPS*: full control but full ops (backups, SSL, monitoring). Wrong trade-off for a solo maintainer.
- *BaaS (Supabase / Firebase)*: minimum code but vendor lock-in and a worse fit for the tRPC + npm-workspaces direction we want.

**PaaS specifics:** documented in the Deployment section below.

---

## Decision C — Database: SQLite + Drizzle ORM

**Decision:** SQLite stored on the PaaS's persistent volume. Drizzle ORM for typesafe queries and migrations.

**Rationale:**

- Army builder scale (hundreds of users, low write volume) is well within SQLite's comfort zone
- Single-file DB = trivial backups (copy file to S3-compatible storage)
- Drizzle is lightweight, typesafe, integrates cleanly with TypeScript
- Easy to migrate to Postgres later (Drizzle supports both with mostly-identical query syntax)

**Alternatives considered:**

- *Postgres + Drizzle*: more concurrency / features. Overkill for this scale; reconsider if growth demands.
- *Postgres + Prisma*: heaviest runtime (generated query engine binary). Rejected.
- *SQLite + raw SQL (no ORM)*: smallest dep surface but loses typesafety on queries. Rejected.

---

## Decision D — API style: tRPC for user ops + raw JSON files for catalog

**Decision:** Two surfaces.

1. `/data/*` — catalog data served as static JSON files (e.g. `GET /data/source-json/death-guard.json`). Same content as today's `war/source-json/*.json`. Language-agnostic; any HTTP client can consume.
2. `/api/trpc/*` — tRPC procedures for user operations (auth, save list, load list, share, etc.). End-to-end TypeScript types between server and client.

**Rationale:**

- Catalog data has many possible consumers (legacy UI, future SPA, mobile app, third-party tools). Static JSON is universally consumable.
- User ops have one primary consumer (stage 3 frontend, stage 4 mobile). Both will be TypeScript. tRPC's typesafety is a meaningful productivity win in that case.
- Splitting the surfaces means we don't pay tRPC complexity for the static catalog reads, and we don't pay REST/OpenAPI boilerplate for the typed user ops.

**Alternatives considered:**

- *REST everywhere*: language-agnostic but doubles boilerplate (Zod input schemas + manual response types). Rejected.
- *tRPC everywhere*: maximum typesafety but third-party tools wanting catalog data would need TS bindings. Rejected.
- *GraphQL*: tooling overhead exceeds value at this scale. Rejected.

---

## Decision E — Auth: magic-link email

**Decision:** Passwordless sign-in via email magic links. Resend as the email transport. No OAuth providers, no hosted auth provider, no password-based accounts.

**Rationale:**

- No passwords to hash / store / reset / breach
- Email captures identity well enough for the use case (saving and sharing army lists)
- Resend's free tier (3000 emails/month) covers any realistic usage
- Standard libraries (or simple custom impl) handle the flow

**Alternatives considered:**

- *Owner-token-in-URL (no accounts)*: simplest, but losing the URL = losing the list. Too fragile for content users invest time in.
- *OAuth (Discord / Google / GitHub)*: high friction if user doesn't already have the chosen provider; each provider needs its own app setup. Discord is well-aligned with the tabletop wargaming audience and could be a future addition.
- *Hosted auth (Clerk / Auth0 / Supabase)*: vendor lock-in plus monthly fees once past free tier. Magic-link is straightforward enough to own.

---

## Decision F — Monorepo: same repo, `apps/api/` subdir, single deployment

**Decision:** Add `apps/api/` to this repo. The Node backend serves both `/api/trpc/*` (user ops) AND the legacy `war/` directory (static files). One PaaS deployment, one Node process.

Future stages: `apps/web/` for the stage 3 frontend; `apps/mobile/` for stage 4 React Native; `packages/shared/` for cross-app TypeScript types.

**Rationale:**

- Eliminates cross-repo coordination for shared types (data-model decisions in `[[data-model]]`)
- One deployment is easiest to operate
- Standard npm workspaces — no Turborepo, no Nx, no extra tooling

**Alternatives considered:**

- *Separate backend deployment*: cleaner boundary at the cost of CORS, two deployment dashboards, two health checks. Rejected.
- *Separate repo for backend*: type-sharing across repos is painful. Rejected.
- *Backend inside `war/`*: mixes new modules with the legacy GWT-era directory structure. Rejected.

---

## Decision G — HTTP framework: Fastify

**Decision:** Fastify for the HTTP layer.

**Rationale:**

- Stable, mature, long-running-process oriented (matches PaaS choice)
- Excellent TS support, schema validation built-in
- `@trpc/server/adapters/fastify` is well-maintained
- Built-in static file plugin handles serving `war/` cleanly
- Faster than Express; less opinionated than Nest

**Alternatives considered:**

- *Hono*: great framework but more edge-runtime oriented; we lose less in a long-running PaaS context. Reasonable alternative.
- *Express*: long-running stable, but worse types and slower. Rejected.
- *Nest*: enterprise framework, too opinionated for a small app. Rejected.

---

## Decision H — Testing: `node --test` + in-memory SQLite, no headless browser in stage 2

**Decision:** Use Node's built-in `node:test` (already used in `tools/test/loader.test.js`) for unit and integration tests. Integration tests run against in-memory SQLite (`better-sqlite3(':memory:')`) and an in-process `EmailTransport` stub. No Playwright / Cypress in stage 2.

**Rationale:**

- Legacy UI is not touched in stage 2; nothing for a browser test to verify
- Stage 3 (new frontend) is where Playwright investment makes sense
- `node --test` matches the existing test infrastructure (zero new tooling)
- In-process tRPC client + stubbed email runs full sign-in flows in <50ms per test

---

## Architecture

### Repo layout (post-stage-2)

```
kule-epicarmyBuilder/
├── apps/
│   └── api/                          ← new in stage 2
│       ├── src/
│       │   ├── index.ts              ← Fastify bootstrap, route registration
│       │   ├── env.ts                ← typed env var parser (zod)
│       │   ├── trpc/
│       │   │   ├── router.ts         ← root tRPC router
│       │   │   ├── auth.ts           ← magic-link procedures
│       │   │   ├── lists.ts          ← user-list save/load/share procedures
│       │   │   └── context.ts        ← session lookup, attaches user to ctx
│       │   ├── db/
│       │   │   ├── schema.ts         ← Drizzle table definitions
│       │   │   ├── client.ts         ← Drizzle db instance
│       │   │   └── migrations/       ← drizzle-kit output
│       │   ├── auth/
│       │   │   ├── magic-link.ts     ← token generation, verification
│       │   │   ├── email.ts          ← EmailTransport interface + Resend impl
│       │   │   └── sessions.ts       ← session cookie helpers
│       │   ├── static/
│       │   │   └── routes.ts         ← serves war/ + /data/* JSON routes
│       │   └── __tests__/            ← node --test files
│       ├── drizzle.config.ts
│       ├── package.json              ← apps/api scoped
│       ├── tsconfig.json
│       └── README.md                 ← dev/test/deploy quickstart
├── packages/
│   └── shared/                       ← new in stage 2, grows in stage 3
│       └── src/
│           └── types.ts              ← re-exports schemas/types.ts + tRPC client types
├── schemas/                          ← unchanged from stage 1
├── tools/                            ← unchanged
├── war/                              ← unchanged; served by apps/api as static
├── docs/                             ← unchanged
├── package.json                      ← root, npm workspaces
└── ROADMAP.md
```

### Request flow

```
Internet
   │
   ▼
PaaS (Railway) — single container, port 3000
   │
   ▼
Fastify app
   ├── GET /                              → 302 to /chooser.html
   ├── GET /chooser.html, /war/**          → serve static from war/
   ├── GET /data/source-json/<file>.json  → serve from war/source-json/ (cached)
   ├── GET /data/lists/<file>.json        → serve from war/lists/ (cached)
   ├── GET /data/factions                 → faction index (computed from inventory)
   ├── POST /api/trpc/<procedure>          → tRPC handler
   │       └── auth.requestMagicLink, auth.verifyMagicLink, auth.signOut, auth.me
   │       └── lists.save, lists.load, lists.listMine, lists.setVisibility, lists.delete
   ├── GET /sign-in?token=…               → magic-link landing (sets cookie, redirects)
   └── GET /healthz                       → 200 for PaaS health checks
```

### User-op request example: save list

```
stage-3 web client
    │ POST /api/trpc/lists.save (Cookie: session=…)
    ▼
Fastify → @trpc/server adapter
    │
    ▼
tRPC context builder: read session cookie → lookup session row → attach user to ctx
    │
    ▼
lists.save procedure: validate input → Drizzle insert → return list row
    │
    ▼
JSON response with typed payload
```

### Catalog request example

```
client (anything: legacy chooser.js, stage-3 web, third-party)
    │ GET /data/source-json/death-guard.json
    ▼
Fastify static plugin → reads war/source-json/death-guard.json
    │
    ▼
file response with Cache-Control: public, max-age=300
```

---

## Data model

Drizzle schema. Four tables. ULIDs as primary keys (sortable, URL-safe, no collisions). All timestamps stored as Unix epoch milliseconds.

### `users`

```ts
export const users = sqliteTable('users', {
    id:              text('id').primaryKey(),               // ulid
    email:           text('email').notNull().unique(),       // lower-cased on write
    display_name:    text('display_name'),                   // optional, user-set
    created_at:      integer('created_at').notNull(),        // ms
    last_sign_in_at: integer('last_sign_in_at'),             // ms, null until first sign-in
});
```

### `magic_link_tokens`

```ts
export const magicLinkTokens = sqliteTable('magic_link_tokens', {
    token_hash:  text('token_hash').primaryKey(),            // sha256 hex; raw never stored
    email:       text('email').notNull(),
    created_at:  integer('created_at').notNull(),            // ms
    expires_at:  integer('expires_at').notNull(),            // ms — 15 min from creation
    consumed_at: integer('consumed_at'),                     // ms, null until used
});
```

Single-use 32-byte tokens, 15-minute expiry. Periodic cleanup of consumed/expired rows older than 24h.

### `sessions`

```ts
export const sessions = sqliteTable('sessions', {
    id:           text('id').primaryKey(),                   // ulid; also the cookie value
    user_id:      text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    created_at:   integer('created_at').notNull(),
    expires_at:   integer('expires_at').notNull(),           // ms — 30 days from creation
    last_seen_at: integer('last_seen_at').notNull(),         // bumped on each authed request
    user_agent:   text('user_agent'),                         // optional, for active-session UI
});
```

Cookie: `session=<ulid>; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` (30 days). Sliding expiry — bump `last_seen_at` on every authed request; extend `expires_at` if `last_seen_at` is >7 days old.

### `user_lists`

```ts
export const userLists = sqliteTable('user_lists', {
    id:            text('id').primaryKey(),                  // ulid
    owner_id:      text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title:         text('title').notNull(),                   // user-set
    list_id:       text('list_id').notNull(),                 // FK-by-string to war/lists/*.json's top-level list_id
    points_target: integer('points_target'),                  // e.g. 3000
    body:          text('body', { mode: 'json' }).notNull(),  // opaque JSON: user selections
    is_public:     integer('is_public', { mode: 'boolean' }).notNull().default(false),
    created_at:    integer('created_at').notNull(),
    updated_at:    integer('updated_at').notNull(),
});
```

`body` is opaque — backend doesn't validate its contents (the stage-3 frontend decides the shape). This lets the editor data shape evolve without DB migrations.

`list_id` is a string FK to `war/lists/*.json`'s top-level `list_id` field. Backend validates on write — rejects unknown `list_id` values against the catalog inventory.

`is_public` controls share-URL behavior: `false` = owner-only; `true` = anyone-with-URL can view (read-only). Editing always requires being the owner.

### Indexes

```ts
index('sessions_user_id_idx').on(sessions.user_id),
index('user_lists_owner_id_idx').on(userLists.owner_id),
index('user_lists_updated_at_idx').on(userLists.updated_at),
index('magic_link_tokens_email_idx').on(magicLinkTokens.email),
```

### Schema NOT in stage 2 (future)

- `list_shares` — granular per-user sharing (v1 has public/private toggle only)
- `list_versions` — undo history
- `list_comments`, `list_likes`, `list_tags` — community features
- `images` — unit photo uploads
- `email_preferences` — opt-out of magic-link resends, etc.

### Migration story

`drizzle-kit generate` produces SQL files in `apps/api/src/db/migrations/`. Migrations run automatically on container startup (idempotent). Local dev uses `drizzle-kit push` for fast iteration; prod uses `drizzle-kit migrate` (only applies committed migrations).

---

## Coexistence with the legacy UI

### What stays unchanged

- `war/chooser.html`, `war/js/chooser.js`, `war/js/ArmyList.js`, `war/js/Force.js`, all `war/js/unitProfiles.*.js`, `war/js/unitProfileLoader.js` — **all of it stays untouched in stage 2**
- The 7 migrated DYNAMIC factions still fetch via `Ajax.Request('./source-json/<faction>.json')`. The Node server serves those files at the same relative path. Sync XHR keeps working; browsers warn about it but it functions.
- localStorage (or whatever the legacy UI uses for in-progress lists) stays as-is. Users of the legacy UI never touch the backend's user-list features.

### What the Node server does differently from `python3 -m http.server`

| What | python http.server | apps/api Node server |
|---|---|---|
| Static file serving (`war/**`) | yes | yes (Fastify static plugin) |
| `/data/factions` index | 404 | computed JSON |
| `/api/trpc/*` | 404 | tRPC handler |
| Cache headers | none | `public, max-age=300` on `/data/*` |
| HTTPS / SSL | no | yes (PaaS-issued cert) |

The legacy UI is unchanged — its relative URLs resolve to the same files as before.

### Local dev workflows (both supported)

1. **Pure legacy work** (touching chooser.js, faction files, etc.): `cd war && python3 -m http.server 8000`. Exactly as today.
2. **Backend or coexistence work**: `npm run dev --workspace apps/api`. Fastify with watch mode, SQLite in `apps/api/dev.db`, in-process email transport.

### Production topology

```
yourdomain.com  →  Railway (Fastify) — serves both /api/trpc/* AND war/ static
```

If Railway is down: GitHub Pages mirror (if enabled) serves `war/` static. Users lose `/api/*` features (save/share) but the legacy UI keeps working because it's purely client-side. **Action item:** check GitHub repo Settings → Pages — is Pages deployment configured to act as a fallback? If not, enable it as a safety net for stage 2 cutover.

### Per-user impact of stage 2 launch

- Users who only use the legacy UI: zero behavior change.
- Users who sign up via the stage-3 frontend (when it ships): gain saved lists, share URLs.
- Users who never sign up: continue with anonymous local-only list-building.

---

## Deployment & ops

### Railway specifics

```
Railway service: kule-api
├── /app                    ← deployed code (ephemeral)
└── /app/data               ← mounted persistent volume (1 GB plenty for years)
    └── prod.db             ← SQLite file
```

Push to master → Railway builds (npm install workspaces, tsc, migrate) → starts Node → health-checks `/healthz` → cuts traffic over.

### Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite file path (Railway: `/app/data/prod.db`; local: `dev.db`) |
| `RESEND_API_KEY` | Email sending |
| `EMAIL_FROM` | Magic-link sender address (e.g. `auth@yourdomain.com`) |
| `SESSION_SECRET` | HMAC key for signing session cookies (32+ bytes) |
| `BASE_URL` | Public origin used to build magic-link URLs |
| `NODE_ENV` | `production` in Railway |
| `PORT` | injected by Railway |

`src/env.ts` parses all of these with zod and exits hard if anything's missing.

### Email transport

Resend free tier (3000 emails/month). Sign up, verify a sender domain via DNS records, get an API key. Magic-link emails are minimal:

```
Subject: Sign in to <yourapp>
Body:    Click this link to sign in. It expires in 15 minutes.
         <BASE_URL>/sign-in?token=<token>
```

### Backups (deferred to S2.9)

Strategy when implemented: tiny in-process cron (`node-cron`) copies `prod.db` to Backblaze B2 or Cloudflare R2 daily. ~$0.005/mo for storage. Out of scope for the initial S2.7 deployment cut; document the risk in the README.

### Monitoring (deferred to S2.10)

Out of scope for initial cut. When usage justifies: Sentry for errors, UptimeRobot for uptime ping, structured Fastify logs already shipped to Railway's log viewer.

### Cost estimate

| Service | ~Monthly |
|---|---|
| Railway hobby + this service | $5-7 |
| Volume (1 GB) | included or ~$0.25 |
| Resend (free tier) | $0 |
| Backups (B2/R2, 1 GB) | <$1 |
| **Total** | **~$5-10** |

---

## Testing & CI

### Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | `node --test` | Pure functions: token hash, env validation, list-id catalog lookup |
| Integration | `node --test` + in-memory SQLite + stubbed email | tRPC procedures end-to-end with sessions |
| Manual smoke | curl + browser | Live PaaS deployment |

### Integration test harness

`buildTestApp()` returns:

- Fresh in-memory SQLite (Drizzle migrations applied)
- tRPC router wired to that DB
- In-process `InProcessEmails` transport that exposes `last()` / `all()` / `clear()`
- A tRPC client that calls procedures directly (no HTTP layer)
- `.withSession(id)` helper for authed procedures

### Example: full auth flow integration test

```ts
test('full magic-link sign-in flow', async () => {
    const { trpc, emails } = buildTestApp();

    await trpc.auth.requestMagicLink.mutate({ email: 'a@example.com' });
    const token = emails.last().body.match(/token=([\w-]+)/)![1];

    const { sessionId } = await trpc.auth.verifyMagicLink.mutate({ token });

    const authed = trpc.withSession(sessionId);
    const me = await authed.auth.me.query();
    assert.strictEqual(me.email, 'a@example.com');
});
```

### CI

Extend `.github/workflows/ci.yml` with one new job:

```yaml
api-tests:
  name: API tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm install --workspaces --include-workspace-root
    - run: npm test --workspace apps/api
```

Runs in <30s, same fast-feedback cadence as the existing five jobs.

### Pre-flight before push

```
npm test --workspace apps/api
npm run typecheck --workspace apps/api
```

Both wrapped under a root `npm run check` for one-command verification.

---

## Implementation stories

Each story is one focused PR; each maps to a GitHub issue.

### Core (8 stories — close stage 2)

| # | Story | Done state | Blocks on |
|---|---|---|---|
| **S2.1** | Monorepo scaffold + apps/api skeleton | Root `package.json` declares workspaces. `apps/api/` has Fastify, `/healthz`, env validation via zod, TS build, watch-mode dev script. `node --test` setup. `npm run dev --workspace apps/api` starts a server on :3000. | — |
| **S2.2** | Static file serving + catalog endpoints | Fastify static plugin serves `war/` at root. `/data/source-json/<file>.json` and `/data/lists/<file>.json` return cached JSON. `/data/factions` returns the inventory. `localhost:3000/chooser.html?list=SM_codex_NETEA` renders identically to today. | S2.1 |
| **S2.3** | Drizzle schema + migrations | `apps/api/src/db/schema.ts` with `users`, `sessions`, `magic_link_tokens`, `user_lists`. `drizzle.config.ts` set up. Migrations generate to `src/db/migrations/`, run on startup. `npm run migrate` creates the tables. | S2.1 |
| **S2.4** | Auth implementation (magic-link) | Token generation/hashing. `EmailTransport` interface + in-process stub. tRPC procedures: `auth.requestMagicLink`, `verifyMagicLink`, `signOut`, `me`. `/sign-in?token=…` landing route. Session cookie + sliding expiry. Integration tests pass. | S2.3 |
| **S2.5** | User-list tRPC procedures | `lists.save`, `load`, `listMine`, `setVisibility`, `delete`. `list_id` validated against catalog inventory. `is_public` toggle. Public lists viewable by anyone with URL; private 404 for non-owners. Ownership check on mutations. Integration tests for each. | S2.4 |
| **S2.6** | Resend integration | Real `ResendTransport` implementation. Magic-link email template. `RESEND_API_KEY` + `EMAIL_FROM` env wiring. Local dev still uses in-process stub. Manual smoke test: request a link → it lands in your inbox. | S2.4 |
| **S2.7** | Railway deployment | Service connected to GitHub. Volume mounted. Env vars set. Push to master → deploys in <3 min. `/healthz` returns 200. CI passes `api-tests` job before deploy. Optional: custom domain. | S2.6 |
| **S2.8** | Documentation update | `apps/api/README.md` with dev/test/deploy quickstart. `ROADMAP.md` "Quick local setup" gets a backend dev path. Update `war/js/unitProfileLoader.md` to note the new `/data/*` endpoints. | S2.7 |

### Optional follow-ups (don't block stage-2 done)

| # | Story | Why deferrable |
|---|---|---|
| **S2.9** | Daily SQLite backups to R2 / B2 | At MVP scale, "losing the DB resets user lists" is recoverable; document the risk in S2.7. Add when usage justifies. |
| **S2.10** | Observability (Sentry / UptimeRobot) | Add when you start having real users complaining about things you can't reproduce. |

### Sequencing

```
S2.1 ──┬── S2.2 ── S2.7 ── S2.8
       │
       └── S2.3 ── S2.4 ── S2.5
                       └── S2.6 ── S2.7
```

**Milestones:**

- **After S2.2:** an HTTP server you can deploy that serves the legacy UI (user-visible parity with python http.server).
- **After S2.4:** magic-link auth works in tests.
- **After S2.5:** user-list save/share/load works in tests.
- **After S2.6:** real emails arrive.
- **After S2.7:** it's live on the internet.
- **After S2.8:** stage 2 done; contributors can pick up; stage 3 can start.

---

## Open items

- **GitHub Pages fallback:** check if Pages is configured to deploy `war/`. If yes, it's a free safety net during Railway downtime. If no, decide whether to enable in S2.7.
- **Resend domain verification:** requires DNS records on the user's chosen sender domain. ~15 min one-time setup; document in S2.6.
- **Custom domain:** optional for S2.7. The Railway-issued URL works for initial launch.
- **List-version migration when `body` shape changes:** stage 3 may discover the editor data shape needs evolving. Schema field is opaque JSON; we'll need a per-list version tag if migrations become non-trivial. Defer until a concrete need surfaces.
- **Rate limiting:** none in v1. Add if magic-link abuse becomes a real problem (Resend's free tier has its own limits).
- **CSRF:** SameSite=Lax cookies cover most cases; tRPC POST endpoints are not classic-form vulnerable. Revisit if we add cross-origin frontends.
- **GDPR / data export:** out of scope until there's a user demanding it. Schema is simple enough that a "delete my account" mutation cascading from `users.id` would handle the basic case.
