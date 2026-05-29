# Faction Grouping & Filtering — Design

**Date:** 2026-05-29
**Stage:** 3.x follow-up to S3.5 (list picker) and S3.6 (my-lists)

## Goal

Group army lists by their parent faction (Space Marines, Imperial Guard, Chaos, etc.) in the SPA, matching the mental model of the legacy `war/index*.html` nav pages. Add a faction filter to both the list-picker and the my-lists page.

## Decisions

1. **Mapping source:** **C** — backend derives a `faction_group` field on `/data/lists` from the `list_id` prefix. SPA stays oblivious to the prefix scheme.
2. **Picker UI:** **Z** — section headers grouped by faction (default expanded), plus a faction filter dropdown at the top.
3. **My-lists UI:** **filter dropdown only** — no section headers. A user typically has <20 lists; headers add visual weight without paying off.

## Prefix → faction_group mapping

Derived by inspecting all 156 lists in `/data/lists`:

| Prefix  | Count | Group label                |
| ------- | ----- | -------------------------- |
| `SM`    | 21    | Space Marines              |
| `IG`    | 22    | Imperial Guard             |
| `CHAOS` | 30    | Chaos                      |
| `EL`    | 27    | Eldar                      |
| `XENOS` | 22    | Xenos                      |
| `ORK`   | 14    | Orks                       |
| `AMTL`  | 11    | Adeptus Mechanicus         |
| `INQ`   | 7     | Inquisition                |
| `30K`   | 1     | Horus Heresy               |
| `SQ`    | 1     | Squats                     |
| _other_ | -     | `"Other"` (catch-all)      |

The mapping lives as a single `const` in `apps/api/src/static/routes.ts` next to `buildListsIndex()`. Adding new prefixes is a one-line code change.

## Backend changes

**File:** `apps/api/src/static/routes.ts`

1. Add `FACTION_GROUP_BY_PREFIX: Record<string, string>` constant with the mapping above.
2. Add helper `factionGroupFor(list_id: string): string` that takes the first `_`-separated token, looks it up, falls back to `"Other"`.
3. Extend `ListIndexEntry` with `faction_group: string` (required, never undefined).
4. Populate it in `buildListsIndex()`.
5. Cache is unchanged — already keyed on file mtime indirectly via TTL.

**Test additions** in `apps/api/src/__tests__/static-routes.test.ts`:

- `GET /data/lists` entries all have `faction_group` set.
- A known `SM_*` list returns `"Space Marines"`.
- A `CHAOS_*` list returns `"Chaos"`.

## Frontend changes

### Picker (`apps/web/src/routes/index.tsx`)

- Add a `faction` filter state next to the existing `ruleset` state.
- Build the visible groups by:
  1. Filter by ruleset (existing).
  2. If `faction` is set, filter to only that group.
  3. Group remaining entries by `faction_group`.
  4. Order the groups by the prefix table above (Space Marines first, Imperial Guard second, …, Other last).
- Render each group as a `<section>` with an `<h2>` header showing the group name and a count (`Space Marines · 21`).
- Inside each section, the existing card grid layout is reused unchanged.
- Faction dropdown lives next to the ruleset dropdown. Options: `All`, then each group that exists in the current ruleset filter (so picking `EPICUK` doesn't show empty `Squats` etc.).
- Empty-state copy: if a filter combination yields zero lists, show "No lists for this filter."

### My Lists (`apps/web/src/routes/lists.tsx`)

- Need the `faction_group` for each saved list. Two implementation options inside this story:
  - **a)** Join client-side: fetch `/data/lists` (already cached for 5 minutes) and look up each saved list's `list_id` to get its group.
  - **b)** Have the `lists.listMine` tRPC procedure include `faction_group`. More work, more layers touched.
- **Pick (a)** — keeps the backend tRPC contract unchanged and reuses the cached index. The client join is O(n) over the user's <100 lists.
- Add a faction dropdown above the lists. Same options shape as the picker: `All`, then each group that appears in the user's lists.
- No section headers on this page.

## Out of scope

- Sub-faction (chapter / legion) sub-headers within a group. Legacy doesn't have them either.
- Collapsing/expanding section groups. Default expanded is enough for now.
- Faction icons (legacy uses `imperial_eagle.png` etc.). Defer; add later if requested.
- Sorting/ordering customization. Lists inside a group keep their existing alphabetical sort.

## Open risks

- **None blocking.** The mapping is a small `const` that's trivial to extend if a new prefix gets added later. If a list_id ever ships without one of the known prefixes, it lands in `"Other"` and remains visible — better than being hidden.
