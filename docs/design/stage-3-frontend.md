# Stage 3 — Modern Frontend (MVP)

**Status:** Decided 2026-05-29. Records six design decisions plus routes, state model, cutover plan, and the eight implementation stories that close the stage-3 MVP.
**Stage:** 3 of 4 (per `ROADMAP.md`).
**Builds on:** `docs/design/stage-2-backend-architecture.md` (backend is the API the frontend consumes).
**Live backend:** https://dnb1fidm0d.c40.airoapp.ai (stage 2 deployed).

## Context

Stage 2 delivered a working backend: tRPC procedures for user lists, magic-link auth, raw JSON catalog endpoints, all served from a Node + Fastify + SQLite + Drizzle stack on GoDaddy's Node.js Hosting platform. The legacy `chooser.html` UI (3,800 lines of Prototype.js + `ArmyList.js` + `Force.js` + per-ruleset `index<X>.html` files) still serves at the root and works.

Stage 3 builds a modern single-page application that consumes the stage-2 API. The new SPA lives alongside the legacy UI rather than replacing it day-one — users opt into the new builder by visiting `/v2`. Eventually the legacy retires (Phase C, out of scope for the MVP).

Per `[[project-users]]`, real users depend on the legacy site staying up. No flag-day cutover. Stage 3 is purely additive until parity is reached.

---

## Decision A — Scope: MVP first

**Decision:** Build the smallest viable replacement for `chooser.html`'s daily-use flow: faction picker, list builder (formations + upgrades + points math), save / load / share via the existing tRPC API. Visual design is functional but plain. Ship to users via an opt-in `/v2` URL; iterate based on feedback.

**Rationale:**

- Lowest upfront design cost, fastest time to a usable artifact.
- Lets the actual UX problems surface from real use, not speculation.
- "Reimagine the UX" risks weeks of design discussion without code; "pixel-perfect port" wastes the rebuild opportunity.

**Explicit MVP scope (in):**

- 7 TanStack Router routes (see Section 3)
- Faction picker, builder, sign-in, my-lists, shared-list viewer
- Save / load / share / setVisibility / delete via existing tRPC procedures
- Magic-link sign-in flow already implemented in stage 2
- TS types shared with backend via `packages/shared/`
- Deployed at `/v2/*` on the same GoDaddy Node process

**Explicit MVP non-goals (deferred):**

- Mobile-first responsive design (S3.9)
- Export options — PDF / plain text / Vassal / TTS (S3.10)
- Drag-and-drop formation reordering (S3.11)
- Account settings UI (S3.12)
- Public list discovery (S3.13)
- Real-time collaborative editing
- i18n
- Offline / PWA
- Account settings (display name, sessions list, delete account)
- Image uploads
- Comments / likes / community features
- Pixel-matched legacy aesthetics

---

## Decision B — Framework: React + Vite + TypeScript

**Decision:** React 18+ with Vite as the build tool, all in TypeScript. React Router via TanStack Router. Component state via React's built-in hooks.

**Rationale:**

- Stage 4's React Native shares code with React via `packages/shared/` (TS types, validation schemas, domain logic, tRPC client). Picking React in stage 3 is a strategic alignment with stage 4.
- Biggest ecosystem of components, libraries, AI-assistance tooling, hireable contributors.
- Vite is the modern default — fast HMR, zero-config TypeScript, no webpack churn.

**Alternatives considered:**

- *Vue 3*: simpler mental model, smaller bundle, excellent tooling. Loses cross-stack code sharing with React Native (stage 4 would mean rewriting). Rejected.
- *SvelteKit*: smallest bundle, ergonomic. Same mobile constraint. Rejected.
- *SolidJS*: React-like API, signal-based, tiny runtime. Same mobile constraint, smaller ecosystem. Rejected.

---

## Decision C — Styling: Tailwind CSS + shadcn/ui

**Decision:** Tailwind CSS for utility-first styling. shadcn/ui (Radix-based components, copy-pasted into the repo, not an npm dep) for accessible component primitives.

**Rationale:**

- Tailwind is the highest-velocity styling approach for MVP work — no separate CSS files, no naming concerns, no specificity wars.
- shadcn/ui gives ownership of component code rather than vendor lock-in. Customize freely; copy only what you need.
- Both are well-trodden 2026 defaults. Strong AI-assistance support, lots of examples.
- shadcn supports dark mode for free.

**Alternatives considered:**

- *Tailwind + Mantine*: npm-installed component library; faster initial scaffolding but heavier bundle and more vendor coupling. Rejected.
- *Plain CSS modules + Radix UI primitives*: full control, more writing. Better fit if a designer is leading; not where this project is. Rejected.
- *MUI*: Material Design aesthetics fight against custom branding. Rejected.

---

## Decision D — State management: TanStack Query + Zustand

**Decision:** TanStack Query (formerly React Query) for server state — wraps the tRPC client, handles loading/error/cache automatically. Zustand for local in-progress list state (the army you're building before you click Save). Auth state is just `trpc.auth.me.useQuery()` — no separate store.

**Rationale:**

- TanStack Query is the standard for server state in 2026. tRPC integrates with it natively.
- Zustand is a small (1KB), pragmatic store for local UI state. Avoids React Context boilerplate and avoids the "should this be in TanStack Query?" anti-pattern of putting unsaved local data in a server-state cache.
- Boundary: the moment a list is saved (mutation succeeds), it becomes server state. Before that, it's pure client state in Zustand.

**Alternatives considered:**

- *TanStack Query + Context/useReducer*: same server story, more boilerplate locally. Acceptable but pointless when Zustand exists.
- *Redux Toolkit + RTK Query*: all-in-one but heavyweight. Overkill.
- *Just useState everywhere*: doesn't scale past a few screens.

---

## Decision E — Router: TanStack Router

**Decision:** TanStack Router for client-side routing. Type-safe routes and params, integrated data loading patterns, file-based or code-based route tree.

**Rationale:**

- Same author as TanStack Query — clean integration story.
- TypeScript-first design fits our TS-everywhere stance.
- Modern alternative to React Router with better DX for typed apps.

**Alternatives considered:**

- *React Router v7*: biggest ecosystem and mindshare; mature. The "safe" pick. Reasonable second choice if a contributor pushes back.
- *Wouter*: tiny, but less suitable as the app grows.

---

## Decision F — Hosting: same GoDaddy server, served by Fastify at /v2/*

**Decision:** Vite builds `apps/web/` to `apps/web/dist/`. The existing Fastify app serves `apps/web/dist/` at `/v2/*` with an SPA-fallback (any unknown path under `/v2` returns `index.html` so TanStack Router takes over client-side). Legacy `war/` static serving at `/` is untouched. One deployment, one origin, no CORS.

**Rationale:**

- Single deployment, single bill, single host — matches the stage-2 "consolidate on GoDaddy" pattern.
- Same-origin means session cookies work without CORS complexity.
- The `/v2/*` namespace gives the new SPA a clean place to live while the legacy UI stays at the root.
- When parity is reached (Phase C), it's just a routing flip — no migration or DNS change.

**Alternatives considered:**

- *Separate static deploy on Cloudflare Pages / Vercel*: cleaner separation but requires CORS configuration, two deployments to manage, vendor lock-in for the static side. Reconsider only if GoDaddy hosting becomes a bottleneck. Rejected for MVP.

---

## Architecture

### Repo layout (post stage-3 MVP)

```
kule-epicarmyBuilder/
├── apps/
│   ├── api/                      ← stage 2 (unchanged at the core)
│   │   ├── src/...               ← Fastify + Drizzle + tRPC
│   │   └── src/static/routes.ts  ← gets a new /v2/* SPA-fallback handler
│   └── web/                      ← new in stage 3
│       ├── src/
│       │   ├── main.tsx          ← Vite entry; mounts <App />, providers
│       │   ├── App.tsx           ← top-level shell
│       │   ├── routes/           ← TanStack Router route tree
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx              ← /v2
│       │   │   ├── sign-in.tsx            ← /v2/sign-in
│       │   │   ├── auth-pending.tsx       ← /v2/auth-pending
│       │   │   ├── lists.tsx              ← /v2/lists
│       │   │   ├── build.$listId.tsx      ← /v2/build/<listId>
│       │   │   └── list.$id.tsx           ← /v2/list/<id>
│       │   ├── components/
│       │   │   ├── ui/                    ← shadcn copy-paste primitives
│       │   │   ├── auth/                  ← SignInForm, AuthGuard
│       │   │   ├── catalog/               ← FactionCard, FactionGrid
│       │   │   ├── builder/               ← FormationRow, UpgradePicker, PointsBar
│       │   │   └── lists/                 ← ListsTable, ListPreview
│       │   ├── lib/
│       │   │   ├── trpc.ts                ← tRPC client + TanStack Query integration
│       │   │   ├── auth-context.tsx
│       │   │   └── format.ts
│       │   ├── stores/
│       │   │   └── builder-store.ts       ← Zustand
│       │   ├── styles/globals.css         ← Tailwind base + shadcn theme vars
│       │   └── routeTree.gen.ts           ← auto-generated by TanStack Router
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── tsconfig.json
│       ├── package.json
│       └── README.md
├── packages/
│   └── shared/                            ← grows in stage 3
│       └── src/
│           ├── trpc-types.ts              ← re-exports AppRouter from apps/api
│           └── domain.ts                  ← shared TS types (Faction, etc.)
└── war/                                   ← legacy, unchanged
```

### Build & dev workflows

**Local dev:**

```bash
# Two terminals:
npm run dev --workspace apps/api    # backend on :3000
npm run dev --workspace apps/web    # Vite on :5173 with HMR
                                    # Vite proxies /api/trpc/* and /data/* to :3000
```

**Production build:**

```bash
npm run build --workspace apps/web    # tsc + vite build → apps/web/dist/
npm run build --workspace apps/api    # tsc → apps/api/dist/
                                       # plus a step that copies apps/web/dist to apps/api/dist/web/
```

### Fastify routing changes

```
GET /                                    → war/index.html (legacy nav, unchanged)
GET /chooser.html, /js/**, /lists/**     → war/ static (legacy, unchanged)
GET /data/*                              → catalog endpoints (unchanged)
POST /api/trpc/*                          → tRPC handler (unchanged)
GET /healthz                             → 200 (unchanged)
GET /sign-in?token=...                   → magic-link landing → 302 to /v2 (changed: was /)

GET /v2                                  → apps/web/dist/index.html               ← new
GET /v2/assets/*                         → apps/web/dist/assets/* (cached aggressively)
GET /v2/*  (catchall)                    → apps/web/dist/index.html (SPA fallback) ← new
```

The SPA-fallback rule: when Fastify can't find a static file under `/v2/*`, return `index.html` so TanStack Router takes over client-side. This is the standard SPA hosting pattern; @fastify/static supports it via a configured wildcard.

### Cross-app type sharing

`apps/web` imports backend types via `packages/shared`:

```ts
// apps/web/src/lib/trpc.ts (sketch)
import { createTRPCReact, httpBatchLink, createTRPCClient } from '@trpc/react-query';
import type { AppRouter } from '@kule/shared/trpc-types';

export const trpc = createTRPCReact<AppRouter>();
export const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: '/api/trpc' })],
});
```

`packages/shared/src/trpc-types.ts` re-exports the `AppRouter` type from `apps/api/src/trpc/index.ts` via TypeScript project references. No runtime cost — types only.

---

## Routes

Seven TanStack Router routes for the MVP.

### `/v2` — Home / faction picker
- **File:** `routes/index.tsx`
- **Auth:** Optional
- **Data:** `useQuery({queryKey: ['factions'], queryFn: () => fetch('/data/factions')})` — TanStack Query cached
- **Shows:** Grid of faction cards (ruleset tag, faction name, status). Click → `/v2/build/<list_id>`
- **Header:** App name, sign-in link or user-menu

### `/v2/sign-in` — Magic-link request
- **File:** `routes/sign-in.tsx`
- **Auth:** Redirect to /v2 if already signed in
- **Shows:** Email input, "Send sign-in link" button
- **Action:** `trpc.auth.requestMagicLink.mutate({email})` → navigate to `/v2/auth-pending?email=<email>`

### `/v2/auth-pending` — Post-magic-link request
- **File:** `routes/auth-pending.tsx`
- **Auth:** None
- **Shows:** "Check your email. We sent a sign-in link to `<email>`." + try-again link
- **No automatic polling.** User clicks the email link → hits backend `/sign-in?token=...` → 302 to /v2 with cookie set

### `/v2/lists` — My saved lists
- **File:** `routes/lists.tsx`
- **Auth:** Required (redirect to /v2/sign-in if not)
- **Data:** `trpc.lists.listMine.useInfiniteQuery({limit: 20})`
- **Shows:** Table/grid of lists. Title, faction, points target, updated time, public/private. Click → `/v2/build/<list_id>?from=<id>`. Delete + setVisibility actions.

### `/v2/build/$listId` — List builder (core feature)
- **File:** `routes/build.$listId.tsx`
- **Path param:** `listId` (e.g. `CHAOS_dg_NETEA`)
- **Optional query:** `?from=<userListId>` to load an existing saved list into the builder
- **Auth:** Optional for browsing; required for save
- **Data:** `/data/lists/<listId>.json` (catalog) + optional `trpc.lists.load({id: from})`
- **Shows:** Left = formation picker by section; right = points readout + violations; footer = title input, points target, save button
- **Client state:** Zustand `builder-store` (see Section 5)

### `/v2/list/$id` — Read-only viewer (shared URL)
- **File:** `routes/list.$id.tsx`
- **Path param:** `id` (user_lists.id ULID)
- **Auth:** Optional. Public lists viewable; private lists 404 to non-owners.
- **Data:** `trpc.lists.load.useQuery({id})`
- **Shows:** Title, points, formations summary (read-only). If owner: "Edit this list" button. If non-owner public: "Make a copy" button (forks into a fresh Zustand state).

### `/v2/*` (catchall) — 404
- **File:** `routes/$.tsx` or `notFoundComponent`
- **Shows:** "Not found" + link to /v2

---

## State model

### Server state — TanStack Query (tRPC integration)

Everything that lives on the backend uses `trpc.<router>.<procedure>.useQuery(...)` or `.useMutation(...)`. Standard cache + invalidation:

| Mutation | Invalidates |
|---|---|
| `lists.save` | `lists.listMine`, `lists.load({id})` if cached |
| `lists.setVisibility` | Same |
| `lists.delete` | `lists.listMine` |
| `auth.requestMagicLink` | Nothing |
| `auth.verifyMagicLink` (via HTTP redirect) | `auth.me` after redirect |
| `auth.signOut` | `auth.me`, full cache clear |

Static `/data/*` endpoints use plain `useQuery` (not via tRPC) since they're not procedures. Long `staleTime` (5min) matches server cache headers.

### Client state — Zustand `builder-store`

The in-progress army list. Lives in memory until save:

```ts
interface BuilderState {
    list_id: string | null;             // war/lists/*.json list_id (faction config)
    user_list_id: string | null;        // user_lists.id if editing a saved list; null for new
    title: string;
    points_target: number | null;
    is_public: boolean;
    formations: Array<{
        instance_id: string;            // client-side ULID; allows multiple of same formation
        formation_string_id: string;    // catalog reference (added in S1.11)
        upgrade_string_ids: string[];
    }>;

    // actions
    initFromCatalog(list_id): void;
    initFromSavedList(saved): void;
    addFormation(formation_string_id): void;
    removeFormation(instance_id): void;
    toggleUpgrade(instance_id, upgrade_string_id): void;
    setTitle(title): void;
    setPointsTarget(n): void;
    setIsPublic(b): void;
    reset(): void;
}
```

**Selectors** (pure functions, used with `useMemo`):

```ts
function totalPoints(state: BuilderState, catalog: ListJson): number
function violations(state: BuilderState, catalog: ListJson): string[]
```

**Save flow:** clicking Save serializes the store into `{formations: [...]}` (opaque to the backend per stage-2 Decision A), calls `trpc.lists.save({id?, title, list_id, body, ...})`, stores returned `id` back into the store as `user_list_id`.

### Auth state — just `trpc.auth.me.useQuery`

No separate auth store. `useAuth()` hook returns `{isLoading, isSignedIn, user}` derived from the query. `<AuthGuard>` wraps protected routes and redirects to /v2/sign-in if not signed in.

---

## Cutover plan

### Phase A — build the SPA at /v2 (this work)

```
/                → war/index.html (legacy)              ← unchanged
/chooser.html    → war/chooser.html (legacy)            ← unchanged
/v2              → apps/web/dist/index.html (new SPA)   ← new
/v2/*            → SPA fallback                          ← new
```

Users find the new SPA by visiting /v2 or via a banner on `chooser.html` (S3.8).

### Phase B — invitation banner

A small fixed banner on `/chooser.html` linking to the equivalent `/v2/build/<list_id>`. Both surfaces work in parallel.

### Phase C — flip the root (post-MVP, when SPA reaches parity)

```
/                → apps/web/dist/index.html (new at root)
/legacy          → war/index.html (archived)
```

Out of scope for the MVP.

### Rollback

The legacy UI is untouched throughout. Reverting any stage-3 commit removes /v2 routes; legacy keeps working.

---

## Implementation stories

### Core (8 stories — close stage 3 MVP)

| # | Story | Done state | Blocks on |
|---|---|---|---|
| **S3.1** | Scaffold apps/web + packages/shared | `apps/web/` with Vite + React + TS + Tailwind + shadcn/ui base. `packages/shared/` with empty index re-exporting types from apps/api. `npm run dev --workspace apps/web` starts Vite on :5173 with HMR. `npm run build --workspace apps/web` produces dist/. | — |
| **S3.2** | Fastify serves apps/web/dist at /v2/* with SPA fallback | After both apps build, the API deployment serves /v2 (200 + SPA index for any /v2/* path; assets cached). Legacy paths untouched. CI builds both apps. | S3.1 |
| **S3.3** | TanStack Router + Query + tRPC client wiring | `routes/__root.tsx` + `routes/index.tsx` (faction picker reading /data/factions). `useAuth()` hook works against /api/trpc/auth.me. Header shows signed-in/out state. | S3.2 |
| **S3.4** | Sign-in flow | `routes/sign-in.tsx` + `routes/auth-pending.tsx`. Submitting the email form sends the magic-link; clicking the email lands the user signed in at /v2. End-to-end. | S3.3 |
| **S3.5** | Builder route + Zustand store + selectors | `routes/build.$listId.tsx`. Pick a faction → builder shows formation sections from /data/lists/<listId>.json. Add/remove formations, toggle upgrades, live points readout. Save calls `trpc.lists.save`. | S3.4 |
| **S3.6** | My lists + load-into-builder | `routes/lists.tsx` paginated via `trpc.lists.listMine.useInfiniteQuery`. Click row → opens builder with `?from=<id>` which hydrates the store via `trpc.lists.load`. Delete + setVisibility actions. | S3.5 |
| **S3.7** | Shared-list viewer | `routes/list.$id.tsx`. Public list → read-only summary. Private to non-owner → 404. Owner sees Edit button. | S3.5 |
| **S3.8** | Banner on chooser.html linking to /v2 | One-line edit in `war/chooser.html` adds a top banner "Try the new builder →" linking to /v2/build/<list_id> for the current list. localStorage opt-out so dismissed banners stay dismissed. | S3.2 (independent of others) |

### Deferred (not blocking stage-3 MVP close)

| # | Story | Why deferred |
|---|---|---|
| **S3.9** | Mobile-responsive polish | MVP desktop-first. Add when usage data shows mobile demand. |
| **S3.10** | Export options (PDF / plain text / Vassal) | Out of MVP scope. Open issue when a user asks. |
| **S3.11** | Drag-and-drop formation reordering | Buttons work for v1. |
| **S3.12** | Account settings page | Display name, sessions, delete account. Add when needed. |
| **S3.13** | Public list discovery | New endpoint + browse UI. Big scope; only if community feature desired. |
| **S3.14** | Retire legacy chooser.html (Phase C flip) | The eventual cutover. Done when usage has migrated. |

### Sequencing

```
S3.1 ── S3.2 ── S3.3 ── S3.4 ── S3.5 ──┬── S3.6
                              S3.8 ──┘    └── S3.7
```

**Milestones inside stage 3:**

- After S3.2: deployable shell at /v2 (placeholder content)
- After S3.4: end-to-end auth works on the SPA
- After S3.5: core feature — build and save a list
- After S3.7: shared URLs work for read-only viewing
- After S3.8: legacy users discover the new UI

**Stage-3 MVP done state:** all 8 core stories closed; new SPA is functional alongside legacy; legacy users have a path to opt in. Stage 4 (mobile) can then start consuming the same backend + sharing types/logic via packages/shared/.

---

## Open items

- **shadcn/ui setup specifics**: shadcn isn't an npm install — it's a CLI that copy-pastes components into your repo. S3.1 should run `npx shadcn-ui@latest init` and include a minimal set (Button, Card, Dialog, Input). More components added per story as needed.
- **TanStack Router code-gen file** (`routeTree.gen.ts`): added to .gitignore? Or committed? Most projects commit it for clarity but ignore the side-effects of regen during dev. Decide during S3.3.
- **Vite proxy config for /api/trpc/* and /data/***: set up in `apps/web/vite.config.ts` so the dev server forwards API calls to localhost:3000. Standard.
- **shared package consumption**: `packages/shared` is a workspace. apps/api and apps/web both reference it. Verify TypeScript project references work cleanly with the npm workspaces setup.
- **Cookie domain on production deploys**: session cookie set at apex domain works for /v2 and / equally. No subdomain trickery needed.
- **Vite production bundle size budget**: monitor with `npx vite-bundle-visualizer` during S3.5+. Keep under 300KB gzipped for the main chunk if possible.
- **First-load performance**: SPA on /v2 means a blank screen until JS loads. Mitigate with a tiny inline-HTML loading state in `apps/web/index.html`.
- **GoDaddy build environment**: stage 2 confirmed GoDaddy can build our existing apps/api (devDeps were available somehow, or the build script worked anyway). Adding apps/web increases build time + node_modules size. Watch the GoDaddy deploy logs in S3.2.
