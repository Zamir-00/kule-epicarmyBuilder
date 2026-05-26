# Roadmap

This is a fork of the Net-EA / Epic 40K army builder, on a path from a static Prototype.js-era web app to a modern, modular, cross-platform tool.

The work is divided into four stages. Each stage produces something shippable; stages are sequenced so later work can depend on earlier work without ever requiring backtracking. Contributors are welcome — pick up any open issue in the current stage's [milestone](https://github.com/Zamir-00/kule-epicarmyBuilder/milestones).

---

## Stage 1 — Data layer modernization (current)

**Goal:** `war/source-json/*.json` becomes the canonical source of truth for unit profiles. The legacy `war/js/unitProfiles.*.js` files are bridges from that data to the existing UI; new factions get added by editing source-json plus a thin JS adapter.

**Why it's stage 1:** every later stage depends on having a clean, complete data layer. The backend in stage 2 serves it; the frontend in stage 3 consumes it; the mobile app in stage 4 syncs it.

### Shipped

- ✅ **Shared `unitProfileLoader.js`** — single library at `war/js/unitProfileLoader.js` exposes `ArmyforgeUnitProfiles.registerFaction({...})`. Each faction file shrinks from ~400 lines of copy-pasted plumbing to ~40-150 lines of declarative config. 19 unit tests under `node --test`.
- ✅ **7 factions migrated** to use the shared loader: Death Guard, Codex Astartes, Explorator Fleet, Hedonic Crusade, Thousand Sons, Vraksian Traitors, Traitor Titan Legions.
- ✅ **`tools/inventory-factions.js`** — classifies every faction file (MIGRATED / DYNAMIC / STATIC-OK / STATIC-NO-SOURCE) and identifies source-json gaps.

### Stories

Stage 1 stories track in [Milestone: Stage 1](https://github.com/Zamir-00/kule-epicarmyBuilder/milestones).

- **S1.4 — Source-json completeness audit & gap fill.** For each STATIC-OK faction, transcribe profiles that exist in the JS literal but are missing from source-json. The smCodexAstartes pilot showed source-json was missing ~44 of 80 profiles; expect similar work per faction. **This is the durable work that survives all later stages.**
- **S1.5 — STATIC-NO-SOURCE factions.** Six files lack a corresponding source-json: `igBaranSiegeMasters`, `igDeathKorpsOfKrieg`, `igMinervanTankLegion`, `igSteelLegion`, `knightWorld`, `spaceMarineFamily`. Either author source-json from scratch (preferred) or accept they stay legacy.
- **S1.6 — Multi-source loader test (`eldarCraftworlds`).** One faction file maps to 4 source-jsons (alaitoc / biel-tan / iyanden / saim-hann). Validates the loader's array-of-sources path.
- **S1.7 — Loader pattern documentation.** `war/js/unitProfileLoader.md` explains the `registerFaction(...)` API and gives a recipe for "I want to add a new faction" / "I want to update an existing faction's stats."
- **S1.8 — CI / regression guards.** GitHub Actions workflow that runs `node --test tools/test/loader.test.js` and `node --check` against every `war/js/unitProfiles.*.js` on each PR. Catches syntax errors (e.g. smart-quote regressions) and broken pure-helper logic before merge.

### Deferred to follow-up

- **S1.9 — Migrate all 36 remaining STATIC factions to the loader.** Each migration takes ~30-60 minutes per faction and the resulting JS files get rewritten when stage 3 ships a new frontend. Better to fill source-json gaps (S1.4) and leave the JS files as-is; migrate piecewise only when a faction needs updates.

### Done state for stage 1

All five open stories closed. Adding a new faction or updating an existing one's stats is documented, requires only `source-json/<faction>.json` + a thin JS adapter, and is verified by CI. Stage 2 can then build a backend on top of source-json without any data scrambling.

---

## Stage 2 — Backend / frontend split

**Goal:** source-json moves from "static files served by `python3 -m http.server`" to "a real backend that serves a clean JSON API." The frontend stops fetching source-json directly via `Ajax.Request`; it calls API endpoints.

**Why before stage 3:** decouples data from UI before rewriting the UI. The new frontend (stage 3) and mobile app (stage 4) both consume the same API.

### Likely stories (sketches — refined when we get here)

- **S2.1 — API design.** Define endpoint shape: `GET /api/factions`, `GET /api/factions/:slug`, `GET /api/lists`, `GET /api/lists/:id`. Decide on REST vs. tRPC vs. GraphQL.
- **S2.2 — Backend service.** Node + Fastify/Hono (something light). Reads from source-json on disk. No database in stage 2 — files are fine for a single-tenant tool.
- **S2.3 — Migrate legacy UI to fetch from API.** The Prototype.js `chooser.js` keeps working but its data source switches.
- **S2.4 — Auth (deferred decision).** If the tool is single-tenant local, none. If hosted, basic auth or none. Decide based on use case.
- **S2.5 — Deployment.** Probably a single Docker container or a Vercel/Fly.io deploy.
- **S2.6 — Backend tests + CI.**

---

## Stage 3 — Modern frontend & better exports

**Goal:** replace `chooser.js` (3,800 lines of Prototype.js), `ArmyList.js`, `Force.js`, and the multiple `index<RULESET>.html` redirects with a single modern SPA. Add export options the current tool lacks.

**Why this order:** the data layer (stage 1) is complete; the backend (stage 2) is stable; we can rewrite the UI without affecting either.

### Likely stories

- **S3.1 — Frontend framework choice.** React, Vue, Svelte. (Given stage 4's React Native, React likely wins for code reuse — but worth a brief evaluation.)
- **S3.2 — Scaffold the SPA.** Vite + TypeScript + chosen framework. Routes for faction browser, list builder, list viewer.
- **S3.3 — Faction selector + unit cards.** Replaces `chooser.js`'s formation/upgrade browsing.
- **S3.4 — Army list builder.** Replaces `ArmyList.js` + `Force.js`. Points totals, formation validation, upgrade selection.
- **S3.5 — Export options.** PDF (currently absent), plain text (currently rough), Vassal-compatible (?), Tabletop Simulator (?). Driven by user demand.
- **S3.6 — Deploy & cutover.** New frontend at root URL; legacy `chooser.html` accessible at `/legacy/chooser.html` during transition.
- **S3.7 — Retire legacy.** Once usage shifts, delete `chooser.js`, `ArmyList.js`, `Force.js`, the redirect HTML files, and Prototype.js.

---

## Stage 4 — React Native mobile app

**Goal:** native iOS/Android app for browsing and building army lists. Shares the backend (stage 2) and ideally a portion of the frontend logic (stage 3).

### Likely stories

- **S4.1 — RN scaffold.** Expo or bare RN.
- **S4.2 — Shared logic with web.** Extract domain logic (list validation, points math, profile lookup) into a framework-agnostic package consumed by both.
- **S4.3 — Mobile-first UI.** Faction browser, list builder, list viewer adapted for touch.
- **S4.4 — Offline mode.** Bundle source-json on-device; sync deltas from backend when online.
- **S4.5 — App Store / Play Store deployment.**

---

## How to contribute

1. Browse [open issues](https://github.com/Zamir-00/kule-epicarmyBuilder/issues) in the current stage's milestone.
2. Comment on the issue you want to claim before starting work, so we don't duplicate effort.
3. Fork the repo, create a feature branch, open a PR referencing the issue.
4. CI must pass (`node --test tools/test/loader.test.js` for any change touching the loader or faction files).
5. For data work (S1.4, S1.5), there's a recipe in [`war/js/unitProfileLoader.md`](war/js/unitProfileLoader.md) — read that first.
6. Commit messages: short summary line, descriptive body when needed. No AI co-author trailers on commits in this project.

### Quick local setup

```bash
git clone https://github.com/Zamir-00/kule-epicarmyBuilder.git
cd kule-epicarmyBuilder
node --test tools/test/loader.test.js     # confirm tests pass (19/19)
cd war && python3 -m http.server 8000     # serve the legacy UI
# Open http://localhost:8000/chooser.html?list=SM_codex_NETEA
```

No `package.json`, no build step, no install — Node 18+ is the only requirement. (Stage 2 will introduce build tooling for the backend.)
