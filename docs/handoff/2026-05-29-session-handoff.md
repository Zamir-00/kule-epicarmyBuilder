# Session Handoff — 2026-05-29

End-of-session snapshot. Read this before picking up the next session — it covers what's live, what's pending deploy, what's open, and where to look first.

## Production

- URL: <https://dnb1fidm0d.c40.airoapp.ai>
- Master HEAD: `e476666` (Merge: print-to-PDF (#36))
- **Deployed bundle hash: `index-DjlEleWB.js`** — this matches commits through PR #35. **PR #36 (print-to-PDF) is merged but not yet deployed.** Click "Redeploy" in the GoDaddy Node.js Hosting UI to ship it.
- GoDaddy does NOT auto-deploy on push to master. Every redeploy is a manual button click.

After the next redeploy, the local `apps/web/dist/assets/index-*.js` hash will appear on production — that's the verification that the bundle is current.

## What shipped this session (10 PRs merged)

| PR | Title |
|----|-------|
| #27 | faction grouping + filter on picker and my-lists |
| #28 | silence harmless 401 (`auth.me` public) + 404 (`vite.svg`) |
| #29 | make `/v2` the default — redirect `/` → `/v2/` |
| #30 | TanStack Router `basepath: '/v2'` |
| #31 | magic-link redirect goes to `/v2/` |
| #32 | banner on legacy `chooser.html` linking to `/v2/` (S3.8) |
| #33 | expandable unit profile cards in builder + viewer (S3.15) |
| #34 | source-for-list kebab-name fallback |
| #35 | source-for-list sibling-faction fallback |
| #36 | print-to-PDF (S3.10) — **pending redeploy** |

## Live verification list (after next redeploy)

- `https://dnb1fidm0d.c40.airoapp.ai/` → 303 → `/v2/` (faction picker).
- `/v2?preview=1` → faction picker (NOT "Not Found").
- `/chooser.html?list=SM_bloodAngels_NETEA` → blue banner up top, "Open new builder →" deep-links to `/v2/build/SM_bloodAngels_NETEA`.
- `/v2/build/CHAOS_dg_NETEA` → build a list, profile cards under each formation, click any unit name to expand its statline.
- `/v2/build/SM_scars_NETEA` → also shows profile cards (via the kebab fallback).
- `/v2/build/AMTL_skitarii_EPICUK` → also shows profile cards (via the sibling-faction fallback).
- **Print/Save as PDF button** appears on builder and shared-viewer pages. Click → system print dialog → "Save as PDF" produces a clean tournament-roster-style PDF with summary + full unit profiles, no app chrome.
- DevTools network tab: no 401 from `/api/trpc/auth.me`, no 404 from `/vite.svg`.

## What's live (feature recap)

- Modern SPA at `/v2/*` (React 18 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Router/Query + Zustand + tRPC client).
- Faction picker (`/v2/`) — section headers grouped by parent faction, ruleset + faction filter dropdowns.
- List builder (`/v2/build/<list_id>`) — saves to your account, public/private toggle, expand units for full statlines, Print/Save as PDF.
- My lists (`/v2/lists`) — faction filter, copy-link, visibility toggle, delete.
- Shared list viewer (`/v2/list/<id>`) — public read-only, copy-as-new-list for signed-in users, Print.
- Magic-link sign-in via Resend (`onboarding@resend.dev` sender, free-tier).
- Expandable unit profile cards on **67 of 156 lists** (see "Profile coverage gap" below).
- Legacy chooser (`/chooser.html` + `/indexNETEA.html` etc.) still works unchanged, with a banner pointing to `/v2`.

## Open work

### GitHub issues

- **#17 — S2.8: documentation update (stage-2 wrap).** Deferred to last by the user.
- **#9 — S1.15: disambiguate 35 duplicate formation names in `traitor-titan-legions.json`.** Stage-1 data cleanup carry-over.

### Untracked follow-ups (not yet ticketed)

- **Profile coverage extension.** 89 catalog lists return 404 from `/data/source-for-list/:list_id`. Of those:
  - ~11 are reachable via a one-time extraction tool that pulls inline `profiles: {…}` data out of `unitProfiles.*.js` files (notably `spaceMarineFamily`, `igBaranSiegeMasters`, `igDeathKorpsOfKrieg`, `igMinervanTankLegion`, `igSteelLegion`, `viorlaTau`, `knightWorld`) into proper `source-json/*.json` files. Plus their siblings via the existing fallback → unlocks ~25 more.
  - ~78 are truly missing — no profile data anywhere in the repo. Mostly older EPICUK/FERC/WM variants of Eldar Craftworlds, Tau, Ork klans, Squats, 30K Talons of the Emperor. Needs content authoring from rulebooks, not coding.
- **Profile name matching.** Today's matcher is case-insensitive substring search in the formation's `units_text` against the source-json `profiles[]` names. Misses on edge cases. Porting the per-faction `aliases` and `normalizer` from the legacy `unitProfiles.*.js` files would give fuller fidelity.

### Postponed

- **Stage 4 — React Native mobile app.** User explicitly said postpone until everything else is ready.

## Tribal knowledge

- **Don't auto-deploy expectations.** GoDaddy's redeploy is manual. Don't claim "it'll be live in a minute" — the user has to click.
- **Health-check quirk.** If GoDaddy's "site down due to root path" banner ever returns, easiest fix is changing the root-path setting in GoDaddy's UI from `/` to `/v2/`. Their checker apparently doesn't accept 3xx as alive even though browsers do.
- **No Co-Authored-By trailer** in commits (saved in memory).
- **Real users on the legacy UI.** Don't make changes that break `/chooser.html?list=…` or the legacy `indexNETEA.html`-style nav menus.
- **Web `npm run build` runs tsc.** CI doesn't run `tsc --noEmit` standalone, but `vite build && tsc --noEmit` does — so build-failing TS errors are caught locally. A pre-existing S3.7 typecheck error was fixed in PR #27 as a drive-by.
- **The source-for-list index** is in `apps/api/src/static/routes.ts:buildSourceForListIndex`. Four resolution sources, in order. See `reference_source-for-list-coverage` in auto-memory for details.

## Where to look first next time

1. `docs/superpowers/specs/2026-05-29-faction-grouping-design.md` — last design doc.
2. `apps/api/src/static/routes.ts` — backend HTTP endpoints, all the indexers.
3. `apps/web/src/routes/` — TanStack Router file-based routes.
4. `apps/web/src/components/UnitProfiles.tsx` — profile card component + name matcher.
5. Recent merged PRs on GitHub — most have a Test plan checklist that says what to verify after deploy.

When you start the next session and the user picks up a thread, this doc + auto-memory should give you enough context to act without re-asking what shipped.
