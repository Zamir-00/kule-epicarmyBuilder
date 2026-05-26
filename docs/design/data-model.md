# Data Model Design

**Status:** Decided 2026-05-27. Records four foundational design decisions for the project's data layer. Affects stages 1-4 of `ROADMAP.md`.

## Context

The project currently has two data files per faction:

- `war/source-json/<faction>.json` — descriptive rulebook data (profiles, special rules, army stats, formations as scraped from rulebook pages)
- `war/lists/<faction>_<ruleset>.json` — buildable per-ruleset configuration (sections, formation IDs, point costs, upgrade IDs)

These files were assembled organically over time. Most fields are free-text strings encoding structured data (`armour: "4+"`, `cost: "300 points"`, `firepower: "AP5+/AT6+"`). Cross-references between files are by display name with per-faction normalizer/alias maps to bridge variations. There is no formal schema; contributors imitate existing files.

Before stage 2 (backend / frontend split) can build a clean API and stage 3 (modern frontend) can consume it without re-implementing parsers, the data model needs explicit decisions on shape, identity, file structure, and schema encoding.

## Decision A — Hybrid field encoding (raw text + structured siblings)

**Decision:** Keep human-readable raw-text fields for display fidelity and hand-editing. Add structured sibling fields next to them when computing, filtering, or sorting matters.

**Example:**

```json
{
  "name": "Plague Marines",
  "type": "INF",
  "type_code": "INF",
  "armour": "4+",
  "armour_save": 4,
  "speed": "15cm",
  "speed_cm": 15,
  "cc": "4+",
  "cc_target": 4,
  "ff": "4+",
  "ff_target": 4
}
```

Formation example:

```json
{
  "id": "plague_marine_retinue",
  "name": "Plague Marine Retinue",
  "cost": "300 points",
  "cost_pts": 300
}
```

**Rationale:**

- The legacy UI shows `armour: "4+"` verbatim. Replacing it forces UI changes.
- The new frontend (stage 3), mobile app (stage 4), and any export tool needs `armour_save: 4` to filter "show me all INF units with armour 4+ or better."
- Hand-authoring is easier with raw text — `"4+"` is the rulebook notation, not `{save: 4}`.
- Validation (via JSON Schema in Decision D) can enforce that raw and structured agree.

**Prioritized structured fields** (initial set; expand as consumers need):

| Raw field | Structured sibling | Type |
|---|---|---|
| `armour: "4+"` | `armour_save: 4` | int or `null` (for "-" or "n/a") |
| `cc: "4+"` | `cc_target: 4` | int or `null` |
| `ff: "4+"` | `ff_target: 4` | int or `null` |
| `speed: "15cm"` | `speed_cm: 15` | int or `null` |
| `type: "INF"` | `type_code: "INF"` | enum: `INF`/`AV`/`LV`/`CH`/`WE`/`AC`/`AC/WE`/`SC`/`Static Defences`/`Tactical Upgrade`/`Formation`/`Fortification`/`Special` |
| `cost: "300 points"` (formations) | `cost_pts: 300` | int |

**Deferred** (genuinely complex; require domain modeling work; tackled when a consumer specifically needs them):

- `weapons[].firepower` notation (`"AP5+/AT6+/AA4+"`, `"4x AP4+/AT4+"`, `"1BP"`, `"MW3+"`, etc.)
- `weapons[].notes` codes (`"MW"`, `"EA(+1)"`, `"FxF"`, `"IC"`, `"Slw"`, etc.)
- `weapons[].range: "(base contact)"` vs `"15cm"` vs `"60cm"`
- `army_stats.initiative_rating.entries[].value: "2+"` (already a soft list)

**Alternatives considered:**

- *Fully structured (drop raw text)*: cleaner API but loses rulebook-verbatim display + larger migration. Rejected.
- *Free-text only, parse in consumers*: minimum migration but every consumer reinvents parsing, drift bites repeatedly (already saw `ff: "5+ (4+)"` vs `ff: "5+"` divergence in the smCodexAstartes pilot). Rejected.
- *Structured only for simple, raw-only for complex*: similar to chosen approach but doesn't allow raw text to act as fallback display for the simple fields. The chosen "raw + structured siblings" is strictly more flexible.

## Decision B — Stable IDs alongside display names

**Decision:** Promote profiles, formations, and upgrades to first-class entities with stable string IDs. Display names remain for UI rendering. New consumers reference by ID; legacy name-based references continue to resolve through the existing alias maps during the transition.

**ID conventions:**

- Lowercase, snake_case, ASCII only
- Derived from the canonical display name via the same normalization used today (`"Plague Marine Retinue"` → `plague_marine_retinue`)
- Stable across rulebook revisions — if a unit gets renamed in a new edition, the old ID stays and a `name` change records the rename
- Globally unique within a faction (collisions error during validation)

**Example:**

```json
{
  "id": "plague_marines",
  "name": "Plague Marines",
  "...": "..."
},
{
  "id": "plague_marine_retinue",
  "name": "Plague Marine Retinue",
  "units": [
    { "id": "plague_marines", "count": 7 }
  ]
}
```

A list file (e.g. `lists/CHAOS_dg_NETEA.json`) references formations and upgrades by ID:

```json
{
  "sections": [
    { "name": "CORE", "formations": [
      { "id": "plague_marine_retinue", "pts": 300, "upgrades": ["vectorium_lord", "plaguecaster_lord", ...] }
    ]}
  ]
}
```

**Migration path:**

1. Add `id` fields to existing source-json profiles/formations/upgrades (derived from current display names via the standard normalizer).
2. Lists files keep working unchanged — the loader continues to resolve by display name via existing alias maps.
3. New list files use IDs.
4. Eventually, old lists get a one-time migration (mechanical script) once stage 2 backend lands and benefits from clean IDs.

**Rationale:**

- Eliminates the 80-entry alias maps as the primary cross-reference mechanism (they become a display-name → ID translation layer used only for legacy data).
- Schema (Decision D) can enforce foreign-key integrity: every formation references existing profile IDs, every upgrade reference is valid.
- API endpoints (stage 2) get clean URLs: `GET /api/factions/death-guard/profiles/plague_marines`.
- IDs are stable across UI rebuilds (stage 3) and mobile (stage 4).

**Alternatives considered:**

- *Full migration to IDs everywhere immediately*: touches 157 lists files and breaks any external tool that parses lists by name. Rejected as too aggressive for stage 1.
- *Names everywhere, formalize aliases in source-json*: doesn't enable foreign-key validation. Rejected.
- *IDs for profiles only*: incomplete; lists still reference formations and upgrades by name. Rejected.

## Decision C — Keep source-json / lists file split

**Decision:** Maintain the two-file structure per faction (`source-json/<faction>.json` + `lists/<faction>_<ruleset>.json`). The two files describe different things and the split is intentional. Resolve the duplication of formation data by treating source-json's `formations[]` as informational only (or removing it).

**File responsibilities:**

| File | Role |
|---|---|
| `war/source-json/<faction>.json` | Authoritative for unit statlines, special rules, army stats. One file per faction. Ruleset-agnostic. |
| `war/lists/<faction>_<ruleset>.json` | Authoritative for army-list configuration: which formations exist in this ruleset, their costs, their available upgrades, their section assignment (CORE/ELITE/SUPPORT). Multiple files per faction (one per ruleset). |

**Duplication resolution:**

The current source-json contains a `formations[]` array with cost/units/upgrades-text. This duplicates information that lives in `lists/<faction>_NETEA.json` (the NETEA ruleset). For NETEA the costs match; for other rulesets (EPICUK, FERC) the source-json's costs would be wrong.

Resolution: `source-json/<faction>.json.formations[]` is informational only — it describes formations as the rulebook page presents them. The authoritative formation config for any ruleset comes from `lists/<faction>_<ruleset>.json`. Tools and the new backend (stage 2) should ignore `formations[]` in source-json.

Long-term option: delete `formations[]` from source-json entirely. Out of scope for the immediate decision; document the rule and revisit during stage 2 implementation.

**Rationale:**

- Smallest migration cost — the current split mostly works.
- Clear separation of concerns: rulebook data vs builder config.
- Multiple rulesets share one source-json (no profile statline duplication across NETEA / EPICUK / FERC).
- Foreign-key integrity (Decision B) makes the join explicit without merging files.

**Alternatives considered:**

- *Merge per faction × ruleset*: ~157 files, duplicates statlines across rulesets. Rejected.
- *Three-tier split (profiles + rules + lists)*: more files, more diffing granularity, weaker contributor onboarding. Rejected — over-engineering for current scale.
- *One file per faction including all rulesets*: files get large, ruleset-specific changes touch the same file. Rejected.

## Decision D — JSON Schema as source of truth + TS types generated

**Decision:** Define the data model in JSON Schema files. Use `ajv-cli` (or equivalent) to validate every source-json and lists file in CI. Generate TypeScript types from the schemas via `json-schema-to-typescript` for consumption by the stage 2 backend, stage 3 frontend, and stage 4 mobile app.

**Files:**

- `schemas/source-json.schema.json` — shape for `war/source-json/<faction>.json`
- `schemas/list.schema.json` — shape for `war/lists/<faction>_<ruleset>.json`
- `schemas/types.ts` (generated, gitignored) — TS types derived from the schemas

**Editor integration:**

Every JSON file references the appropriate schema via `$schema`:

```json
{
  "$schema": "../../schemas/source-json.schema.json",
  "metadata": { ... }
}
```

VS Code and most modern editors then provide autocomplete + inline validation while hand-editing.

**CI integration (relates to S1.8):**

GitHub Actions job runs `ajv-cli validate --spec=draft7 -s schemas/source-json.schema.json -d 'war/source-json/*.json'` and similar for lists. Fails the PR on validation errors.

**Rationale:**

- JSON Schema is language-agnostic and standards-based. Multiple consumers (Node backend, TS frontend, Swift/Kotlin mobile, exporters) can all validate against the same spec.
- TS types from the same schema gives editor ergonomics in the frontend/mobile code without manual type duplication.
- Editor validation catches drift at edit time, not in CI.
- Existing data files (source-json/*, lists/*) can be progressively validated as the schema solidifies.

**Alternatives considered:**

- *TypeScript types only*: better DX in TS code but no editor validation for hand-edited JSON. Rejected.
- *JSON Schema only*: loses the TS type ergonomics. Marginal cost to add type generation. Rejected.
- *Markdown documentation only*: no automated validation. Rejected as too weak given the data-cleanup work in S1.4 needs a validation backstop.

## Worked example

A minimal Death Guard `source-json/death-guard.json` under the new model:

```json
{
  "$schema": "../../schemas/source-json.schema.json",
  "metadata": {
    "id": "death-guard",
    "name": "Death Guard",
    "version": "0.7.2",
    "rulebook_url": "https://tp.net-armageddon.org/army-lists/death-guard.html"
  },
  "army_stats": {
    "strategy_rating": 4,
    "faction_tags": ["Chaos", "Nurgle"],
    "initiative_rating": {
      "default": 1,
      "exceptions": [
        { "scope": "Aircraft, Spacecraft, Contagion Tower, Plague Tower, Blight Drone, Plague Zombie Infestation", "value": 2 }
      ]
    }
  },
  "special_rules": [
    { "id": "implacable_advance", "name": "Implacable Advance", "text": "No formations can March. ..." },
    { "id": "nurgles_rot", "name": "Nurgle's Rot", "text": "..." }
  ],
  "profiles": [
    {
      "id": "plague_marines",
      "name": "Plague Marines",
      "type": "INF",
      "type_code": "INF",
      "armour": "4+",
      "armour_save": 4,
      "cc": "4+",
      "cc_target": 4,
      "ff": "4+",
      "ff_target": 4,
      "speed": "15cm",
      "speed_cm": 15,
      "weapons": [
        { "name": "Bolters", "range": "15cm", "firepower": "Small Arms", "notes": ["MW"] }
      ],
      "abilities": ["Reinforced Armour", "Slow and Steady"]
    }
  ]
}
```

A corresponding `lists/CHAOS_dg_NETEA.json` (formations now reference profile IDs):

```json
{
  "$schema": "../../schemas/list.schema.json",
  "id": "CHAOS_dg_NETEA",
  "faction_id": "death-guard",
  "ruleset": "NETEA",
  "version": "V0.7.2",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "id": "plague_marine_retinue",
          "name": "Plague Marine Retinue",
          "cost_pts": 300,
          "units": [{ "profile_id": "plague_marines", "count": 7 }],
          "upgrades": ["vectorium_lord", "plaguecaster_lord", "chaos_champion"]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": "vectorium_lord", "name": "Vectorium Lord", "cost_pts": 0 }
  ]
}
```

## Migration impact

| Surface | Change | Effort |
|---|---|---|
| `war/source-json/*.json` | Add `id` field to profiles. Add structured siblings (armour_save, etc.). Drop provenance fields once data is verified. | Per-faction, mostly mechanical, ~30 min/file |
| `war/lists/*.json` | Add `id`, `faction_id`, `ruleset`. Migrate formation/upgrade references from name to id. | Mostly mechanical via script; ~10 min/file |
| `war/js/unitProfileLoader.js` | No change required during transition — existing alias-based lookup still works. Optionally add direct ID lookup path. | Minor |
| `war/js/unitProfiles.<faction>.js` (7 migrated) | No change — keep working via aliases. | None |
| `war/js/unitProfiles.<faction>.js` (43 unmigrated) | No change — legacy continues. | None (per S1.9 deferral) |
| `schemas/` | New directory. Write JSON Schema + type generation config. | One-time, ~4-8 hours |
| `.github/workflows/ci.yml` | Add ajv-cli validation step (overlaps with S1.8). | Minor |

## Open items

- **Field-by-field structured-sibling list** — Decision A lists the initial set; expand as needed during implementation.
- **Profile ID naming scheme for ambiguous cases** — e.g. `"Plague Hulk (test 070)"` slugs to `plague_hulk_test_070` under the standard normalizer. Acceptable, but worth documenting the rule.
- **Provenance field deprecation** — `source_section`, `parse_confidence`, `parse_warnings`, `ambiguity_reasons`, `is_reference_or_ambiguous` were useful during scraping. Once data is verified, drop them. Probably a stage-1 cleanup task.
- **Versioning at the profile level** — current `metadata.version` is faction-wide. If a rulebook revision changes a single unit's stats, do we want per-profile versioning? Defer until a consumer needs it.
- **i18n** — names/text are English-only today. Schema should not paint into a corner; consider `name: string | { en: string, ... }` as an evolution path but not implement now.
- **Image / asset references** — modernized frontend (stage 3) likely wants miniature images. Schema should allow `image_url?: string` on profiles and formations as a future-proof addition.

## Next steps

These decisions create new stage-1 stories to track in GitHub:

- **S1.10 — Define and publish JSON Schema** for source-json and lists. Generate TS types. Add `$schema` references. Set up CI validation. Overlaps with S1.8.
- **S1.11 — Add IDs to source-json entities.** Mechanical script; backfill `id` fields across all 56 source-json files.
- **S1.12 — Add structured field siblings.** Per Decision A's prioritized list. Per-faction, mostly mechanical.
- **S1.13 — Drop duplicated `formations[]` from source-json** OR mark it informational. Per Decision C.

S1.4 (source-json completeness audit) should run BEFORE S1.10-S1.13 so the gap-fill work happens against the current loose schema, not against the new strict one. Tightening the schema after data is complete is easier than gap-filling under schema validation pressure.
