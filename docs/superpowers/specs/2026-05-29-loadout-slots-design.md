# Formation loadout slots — design

**Status:** Draft — pending user review
**Date:** 2026-05-29
**Builds on:** S3.16 (`swap_slots[]`, PR #37) + swap-slot backfill (PR #38).

## Goal

Introduce a `loadout_slots[]` primitive that models "formation includes N copies of a unit, each independently picks its weapon/variant from M options, repeats allowed" — the dominant rulebook pattern (930 of 3,153 `upgradeConstraints` rows fall into this shape; 138 single-pick swaps that S3.16 + #38 already shipped do NOT).

After this lands, the modern builder reaches **legacy parity** for the largest unmodeled rule pattern: Ordinatus Minorus's 2× Minorus loadout, Warlord Titan's 2× weapon configuration, Costantin Valdor's 3× Custodes detachment composition, and ~900 similar rules across every faction.

The legacy `chooser.html` renders these as hover-pick-each-unit interactions (see [[loadout-slots-ux]]). The modern equivalent is a compact chip strip with click-popover, scaling cleanly from 2 chips to 9+ without crowding the formation card.

## Scope

- All four `upgradeConstraints` patterns where `min/max != 1` are covered by one unified data shape:
  - `min=max=N` — "select exactly N" (~303 rules)
  - `min=undefined, max=N` — "up to N" (~340 rules)
  - `min=N, max=undefined` — "at least N" (~100 rules)
  - `min=A, max=B` — range (~80 rules)
- Sibling concept to S3.16's `swap_slots[]` — does NOT generalize the existing field. S3.16 keeps its single-pick semantics; this spec adds a parallel primitive for the multi-pick case. Persistence shapes differ (string-per-slot vs array-per-slot); UI components differ (radio/checkbox vs chip+popover); migration scripts are separate.

## Why this matters

138 single-pick swap_slots shipped in S3.16/#38 covered 23% of the constraint-driven legacy gap. The remaining 77% (~930 rules) all share the same shape: "the formation has N positions, each picks independently from a menu". Without modeling this, the modern builder under-expresses real list-building for every Titan, Knight, Custodes, Imperial Guard, and most Chaos formations.

## Design at a glance

- New optional `loadout_slots[]` array on each formation in `war/lists/*.json`.
- Slot has `string_id`, `label`, optional `min`/`max`, plus a `variants[]` array referencing top-level `upgrades[]` (same pattern as swap_slots).
- Variants may carry `is_default: true` (at most one per slot). When a default exists and `min` is set, the formation's `cost_pts` is the price-with-N-defaults-baked-in.
- Builder renders a chip-strip per slot under the existing "Composition" section — N chips for filled positions plus an optional `+ Add` button when `max` allows growth.
- Chip click opens a popover with the variant menu; selection updates state + closes the popover. Removable positions show a `×` button on hover.
- Saved-list body bumps to `body_version: 3` and gains `loadout_choices: Record<slot_string_id, variant_string_id[]>` per formation instance. Save-time canonicalization strips slot entries whose positions match the natural initial state.
- Migration script `tools/migrate-loadouts.mjs` mirrors `migrate-swaps.mjs`: tiered classification (high/medium/skip), idempotent, leaves original `upgradeConstraints` rows in place (legacy chooser unaffected).

## 1. Data model

Extend `schemas/list.schema.json` to allow an optional `loadout_slots[]` per formation:

```jsonc
{
  "string_id": "warlord_battle_titan",
  "id": 503,
  "name": "Warlord Battle Titan",
  "pts": 725,
  "cost_pts": 725,
  "upgrades": [80, 82, 83, 84],
  "swap_slots": [ /* unchanged S3.16 */ ],
  "loadout_slots": [
    {
      "string_id": "weapons",
      "label": "Weapons",
      "min": 2,
      "max": 2,
      "variants": [
        { "upgrade_id": 50, "is_default": true },
        { "upgrade_id": 51 },
        { "upgrade_id": 52 },
        { "upgrade_id": 53 },
        { "upgrade_id": 54 },
        { "upgrade_id": 55 }
      ]
    }
  ]
}
```

**Field semantics:**

- `string_id` (required, unique across both `swap_slots[]` and `loadout_slots[]` on the same formation).
- `label` (required) — the chip strip's row prefix (e.g., `"Weapons"`).
- `min`, `max` (both optional, integers ≥ 0):
  - both set → `min <= max`
  - only `min` → "at least N", open-ended ceiling
  - only `max` → "up to N", optional from 0
  - both unset → "any number" (rare; not blocked but flagged in validator)
- `variants[]` (required, length ≥ 1):
  - `upgrade_id` (required) — references a row in the list's top-level `upgrades[]`. Polymorphic `number | string` matching the existing pattern.
  - `is_default` (optional boolean) — at most one variant per slot may set this.

**Default-state rule:**

- If a default exists AND `min` is set: positions start filled with N copies of the default. The formation's `cost_pts` already includes the default's pts × N.
- If a default exists but `min` is unset: positions still start empty (rules treat this as "may add up to max", default would be misleading).
- If no default: positions start empty. For `min > 0`, that surfaces a validation banner (the slot requires explicit picks).

**Positions are interchangeable.** The data layer has no position identity ("left arm" vs "right arm"). The legacy `upgradeConstraints` doesn't encode it either. Future schema extension if rulebook semantics ever need it.

**Schema validation rules** (`tools/validate-lists.mjs` semantic checks, extending S3.16's swap-slot pass):

- `loadout_slots[]` is optional.
- Each slot requires `string_id`, `label`, non-empty `variants[]`.
- If both `min` and `max` set: `min <= max`. If only `min` set: `min >= 0`. If only `max` set: `max >= 1`.
- At most one variant has `is_default: true`.
- Every `variant.upgrade_id` resolves in the list's top-level `upgrades[]`.
- No variant upgrade is also in the formation's plain `upgrades[]` (would double-render).
- No variant upgrade is also in any sibling `swap_slot.variants[]` on the same formation (cross-system double-render).
- `string_id` is unique across both `swap_slots[]` and `loadout_slots[]` on the same formation.

## 2. Migration / backfill

New script `tools/migrate-loadouts.mjs` (separate from `migrate-swaps.mjs` — different filter, different output shape, focused concerns).

**Selection rule:** scan `war/lists/*.json` for `upgradeConstraints[]` rows where:

- `from.length >= 1`
- `appliesTo.length >= 1`
- min/max is NOT `min=max=1` (already handled by `migrate-swaps.mjs`)

**Tiered classification:**

- **High-confidence auto-apply** — all references resolve cleanly, no overlap with the formation's plain `upgrades[]`, no overlap with existing `swap_slot.variants[]` on the target formation, no already-migrated `loadout_slot` covering the same `from` set on the target. Apply per-formation (the partial-migration bug-class from S3.16 commit `21d21d6` applies — iterate `appliesTo` independently, never `break` early).
- **Medium-confidence skip + report** — any blocking condition: missing upgrade reference, missing formation, overlap with `upgrades[]`, overlap with `swap_slots[]`. Logged for human review.
- **Skip silently** — already-migrated. Idempotent on re-run.

**Default-variant heuristic for auto-apply:**

| Pattern | Default rule |
|---|---|
| `min=max=N` | Cheapest variant gets `is_default: true`. |
| `min=undefined, max=N` ("up to N") | **No default** — positions start empty. |
| `min=N, max=undefined` ("at least N") | Cheapest variant gets `is_default: true`. |
| `min=A, max=B` range | Cheapest variant gets `is_default: true`. |

The rule encodes the rulebook intuition: when there's a required minimum, the formation has a "base loadout" worth defaulting; when min is unset, the slot is purely optional.

**Tiebreaker** for "cheapest variant": if multiple variants share the lowest `cost_pts`, the first variant listed in `from[]` (the original constraint's order) wins. This is the same convention used by `migrate-swaps.mjs` for its all-same-pts case, applied here to break ties under the cheapest-wins rule.

`min: 0` in the source data is normalized to `min: undefined` (the migration drops the explicit zero) for consistency.

**Slot string_id generation:** `loadout_${variantStringIds.join('_or_')}`.slice(0, 80)` with truncation-collision dedupe (`_2`, `_3`, etc.) within the formation. Also checks against existing `swap_slot.string_id` values on the same formation (the cross-system uniqueness rule from §1).

**Slot label heuristic:** start with `"Choice"`. A relabeler (extension of `tools/relabel-swap-slots.mjs` or a sibling `tools/relabel-loadout-slots.mjs`) applies pattern-based labels:

- All variants `*Custodes*` → `"Custodes detachment"`.
- All variants `Paired *` → `"Paired weapons"`.
- All variants `*Cannon*` / `*Blaster*` / `*Missile*` / `*Laser*` → `"Weapons"`.
- All variants `Minorus *` → `"Minorus loadout"`.
- Unmatched → stays `"Choice"`.

**Preservation of legacy constraints:** original `upgradeConstraints[]` rows are **never removed**. Legacy `chooser.html` continues to enforce them; modern builder reads `loadout_slots[]` alongside. Same posture as S3.16.

**Rollout pattern:** dry-run by default, `--apply` to write. Same per-faction or one-big-PR options as PR #38.

## 3. Builder UI

Both `swap_slots[]` and `loadout_slots[]` render under the existing **"Composition" subsection** added in S3.16. Each slot's `label` becomes the row prefix; the row body differs by slot type (radio/checkbox for swaps, chip strip for loadouts).

**On-screen layout sketch:**

```
Warlord Battle Titan                          725 pts
─────────────────────────────────────────────────────
Composition
  Weapons:    [Macro Gatling Blaster ▾] [Sunfury Plasma Annihilator ▾]
  (existing swap_slots, if any, render as before:)
  Support:    ☐ Replace X with Y (+0)
─────────────────────────────────────────────────────
Upgrades
  ☐ Crew Skill (+25)
```

**New components:**

- `<LoadoutSlotControl />` — one row per loadout slot. Renders the chip strip + the `+ Add` button when applicable.
- `<LoadoutChip />` — single chip. Renders `[variant_name (cost_annotation) ▾]`. Click opens a `<LoadoutVariantPopover />`. Hover shows a `×` button when the position is removable.
- `<LoadoutVariantPopover />` — shadcn Popover primitive. Lists all variants with the current selection marked. Click a variant: set and close. Esc / outside-click: cancel. Keyboard: Up/Down/Enter.

**Cost annotation rule:**

- If the slot has a default: chip shows the *delta vs default* (`(+0)`, `(+25)`, `(−10)`). Matches S3.16's swap-chip behavior.
- If no default: chip shows the variant's *absolute pts* (`(50)`).

**Per-pattern initial rendering:**

| Pattern | Initial chip strip |
|---|---|
| `min=max=N`, default exists | N chips, all = default. No remove buttons. No `+ Add` button. |
| `min=max=N`, no default | N empty placeholder chips `[Select… ▾]`. Validation banner flags "must pick". |
| `min=undef, max=N` | 0 chips. `+ Add` button visible. |
| `min=N, max=undef` | N default chips + `+ Add`. First N positions not removable. |
| `min=A, max=B` | A default chips + `+ Add` (up to B total). First A positions not removable. |

**Cost calculation** — extends `selectors.ts` with `loadoutCostForFormation(catalog, formation, loadout_choices)`:

```
totalCost = formation.cost_pts
          + Σ chosen.cost_pts (additive upgrades)
          + swapDeltaForFormation(...)
          + loadoutCostForFormation(...)

loadoutCostForFormation(...) =
  for each slot:
    if default exists:
      Σ_positions (chosen.pts − default.pts)
    else:
      Σ_positions chosen.pts
```

**Print view:**

For each loadout slot, print one line per *distinct* variant in the position list, collapsing identical adjacent positions:

```
Warlord Battle Titan                          725 pts
  • Weapons: 2x Macro Gatling Blaster
```

When positions differ:

```
  • Weapons: Macro Gatling Blaster, Sunfury Plasma Annihilator
```

**Validation surface in the yellow banner:**

When a loadout slot's current position count is less than `min`:

```
Warlord Battle Titan: 'Weapons' requires at least 2 selections (currently 1).
```

The chip strip itself gets a `border-destructive/40 bg-destructive/10` tint so the user can locate the issue without scrolling.

**Accessibility:** chips are `<button>`s with informative `aria-label`s (`"Position 1 of 2 in Weapons: Macro Gatling Blaster"`). Popover is shadcn's `Popover` primitive (`role="dialog"`, focus trap). `+ Add` and `×` buttons have explicit labels.

**Empty-state behavior:** if a formation has no `loadout_slots`, the new rows simply don't render. Composition section continues to behave identically to S3.16 when only swap_slots exist (or no slots at all, in which case it hides entirely).

## 4. Saved-list body shape

**`body_version` bumps to 3.** v1 (legacy free-form), v2 (S3.16 with `swap_choices`), v3 (this spec, adds `loadout_choices`).

```jsonc
{
  "body_version": 3,
  "formations": [
    {
      "instance_id": "01HQ...",
      "formation_string_id": "warlord_battle_titan",
      "upgrade_string_ids": [],
      "swap_choices": { "support": "rapier_lasers" },
      "loadout_choices": {
        "weapons": ["macro_gatling_blaster", "sunfury_plasma_annihilator"]
      }
    }
  ]
}
```

`loadout_choices` is `Record<slot_string_id, string[]>`. Array length = filled position count. No nulls.

**Save-time canonicalization** (`canonicalizeLoadoutChoices` helper in `selectors.ts`, called once in `handleSave` before sending to tRPC):

- If the slot's positions equal `[default × min]` (canonical state when default exists and `min` is set): drop the entry.
- If positions are empty AND the canonical initial state is empty: drop the entry.
- Otherwise: write the full array.

Keeps persisted bodies small and lets data-file default changes propagate sensibly to old saves.

**Load-time semantics:** `initFromSavedList()` reads `body.loadout_choices ?? {}`. The new `getLoadoutPositions(catalog, formation_def, instance, slot_string_id)` selector resolves the canonical positions at render time (handles missing slots, stale variants, catalog drift).

**Stale-data handling (catalog drift):**

| Drift case | Behavior |
|---|---|
| Slot removed from catalog | Drop the `loadout_choices` entry, console-warn once. |
| Variant removed | Per-position: replace with default (if exists), else drop the position. |
| `min/max` widened | Existing positions stay; user can add up to new max. |
| `min/max` narrowed | Positions over max truncated; under min padded with defaults (if exist) or flagged. |
| Formation removed | Existing "Unknown formation" warning row handles this. |

**Server-side validation** (extends `apps/api/src/trpc/lists.ts`'s Zod schema and the semantic walk):

```ts
const formationBodyShape = z.object({
  instance_id: z.string().min(1),
  formation_string_id: z.string().min(1),
  upgrade_string_ids: z.array(z.string()),
  swap_choices: z.record(z.string(), z.string()).optional(),
  loadout_choices: z.record(z.string(), z.array(z.string())).optional(),
});

const bodyShape = z.object({
  body_version: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  formations: z.array(formationBodyShape).optional(),
}).passthrough();
```

Semantic walk (after the swap_choices walk):

- For each formation's `loadout_choices`:
  - Look up the formation in the cached per-list catalog (`getListCatalog`).
  - For each slot key: confirm it's a real `loadout_slot.string_id` on the formation.
  - For each variant value in the array: confirm it resolves to one of `slot.variants[].upgrade.string_id`.
  - Confirm the array length is in `[slot.min ?? 0, slot.max ?? Infinity]`.
  - Confirm no slot-key collision with the same instance's `swap_choices`.

Each failure throws `TRPCError({ code: 'BAD_REQUEST', message: '<path>: <reason>' })`.

**Builder-store changes** (`apps/web/src/stores/builder-store.ts`):

- Add `loadout_choices?: Record<string, string[]>` to `BuilderFormation`.
- Three new actions, each operating on a single slot:
  - `setLoadoutPosition(instance_id, slot_string_id, position_index, variant_string_id)`.
  - `appendLoadoutPosition(instance_id, slot_string_id, variant_string_id)`.
  - `removeLoadoutPosition(instance_id, slot_string_id, position_index)`.
- Reads use the new `getLoadoutPositions()` selector.

**Builder save path** — `handleSave` runs `formations.map(f => canonicalizeLoadoutChoices(catalog, f))` before the `lists.save.mutate` call. `body_version: 3` always written for new saves.

## 5. Validation and error handling

Three tiers, mirroring S3.16's architecture.

**Tier 1 — Catalog schema validation (CI gate).** All semantic rules from §1, enforced by `tools/validate-lists.mjs`. CI fails malformed list files. Existing 156 lists pass unchanged (the field is optional).

**Tier 2 — Server-side `lists.save` validation.** Detailed in §4. Specific BAD_REQUEST messages for: unknown slot key, invalid variant, position count below min, position count above max, slot key collision between `swap_choices` and `loadout_choices`, unknown `body_version`. Validation order inside `save`: Zod parse → body size → swap_choices walk → loadout_choices walk → DB write.

**Tier 3 — Client-side resilience.** Loader and render path never crash on catalog drift; specific behaviors per §4's stale-data table. Plus the new yellow-banner message + chip-strip destructive tint when min isn't satisfied.

**Known tech debt called out:** ~100 "min=N, max=undef" open-ended rules will be migrated with cheapest-as-default and `+ Add` button affordance — but the rulebook may imply soft ceilings not encoded in the data. The migration handles them mechanically; reviewers may override per-faction during PR review. Same posture as S3.16's medium-confidence rows.

**Out of validation scope:** inter-slot dependencies, total-pts constraints beyond the existing points-target violation, faction-wide `perArmy: true` rules.

## 6. Tests

Five surfaces, matched to existing `node:test` stack.

**1. Schema fixtures** (`tools/test/fixtures/loadout-slots/`):

Positive fixtures: happy (`min=max=2` with default), happy-open (`max=3, no default`), happy-range (`min=2, max=4`).

Negative fixtures (each must fail with a debuggable error path):

- `min-greater-than-max.json`
- `two-defaults.json`
- `variant-not-in-upgrades.json`
- `variant-also-in-formation-upgrades.json`
- `variant-also-in-swap-slot.json` (cross-system double-render check)
- `duplicate-string-id-cross-system.json` (cross-system uniqueness check)
- `empty-variants.json`

**2. Migration-script tests** (`tools/test/migrate-loadouts.test.js`):

- High-confidence `min=max=N` transform (default cheapest).
- High-confidence `min=undef, max=N` transform (no default).
- High-confidence range transform.
- Medium-confidence: missing upgrade.
- Medium-confidence: variant overlap with formation's `upgrades[]`.
- Medium-confidence: variant overlap with sibling `swap_slot.variants[]` (cross-system).
- Idempotency: re-running on output yields the same JSON + empty report.
- Partial-migration per-formation: `appliesTo: [F1, F2]`, F1 already migrated, F2 not → only F2 applied.
- Truncation-collision dedupe via `_2`, `_3` suffixes.

**3. Store + selector tests** (`apps/web/src/stores/__tests__/selectors.test.ts`, extended):

- `getLoadoutPositions` resolution for: all four patterns × (default present | no default) × (saved state | empty).
- Catalog drift: stale variant replaced with default; removed slot drops entry.
- `loadoutCostForFormation`: delta math with default; absolute math without default; zero when no slots.
- `totalPoints` integration: combined base + upgrades + swap_delta + loadout_cost.
- Store actions: `setLoadoutPosition`, `appendLoadoutPosition`, `removeLoadoutPosition` — each verified end-to-end.
- `canonicalizeLoadoutChoices` strips canonical states and keeps non-canonical ones.
- Legacy v1/v2 body loads cleanly (no `loadout_choices` field).
- `violations` includes the "requires at least N" message when under-filled.

**4. Server-side tRPC integration tests** (extended `apps/api/src/__tests__/integration/lists.test.ts`):

- Save with valid `loadout_choices` body succeeds, body round-trips.
- Save fails on each rejection path: unknown slot, invalid variant, count below min, count above max, slot key collision with swap_choices, unknown `body_version`.
- `body_version: 3` round-trip preserves both `swap_choices` and `loadout_choices`.
- `body_version: 1` and `2` legacy bodies still save cleanly via `.passthrough()`.

**5. Manual smoke test** (documented; not automated — same posture as S3.16):

1. Load a list with a loadout-slot formation (e.g., the Warlord case in `AMTL_Adeptus_Titanicus_EPICUK`).
2. Add the formation → confirm chip strip with default positions + correct total points.
3. Click a chip → popover opens → pick non-default → total updates by the delta.
4. Save → reload → state persists exactly.
5. Print preview shows the resolved positions per slot.
6. Formation with `min=undef, max=N` → starts with 0 chips + `+ Add` → add via popover → chips appear.
7. Formation with `min=N, max=undef` → starts with N defaults + `+ Add` → hover above-min chip shows `×`; below-min does not.
8. Force a min violation (remove a chip) → yellow banner shows; chip strip gets destructive tint.
9. Shared viewer (signed-out incognito) of the saved list → chips render as read-only static badges; print matches.
10. Legacy `chooser.html?list=<same_list>` → original `upgradeConstraints` rule still enforced (untouched).

**Out of scope for tests:**

- Playwright/Cypress UI automation (not in stage-3's stack).
- Visual regression on the chip + popover (covered by manual smoke).
- Backfill correctness across all 156 lists' loadout candidates (handled in the per-faction / one-big-PR pattern post-spec).
- Performance benchmarks (chip rendering is cheap; not worth maintaining).

## 7. Out of scope and follow-ups

**Out of scope:**

1. Constraint enforcement of remaining `upgradeConstraints` rows (compound rules, `perArmy: true`, etc.) in the modern builder. Same posture as S3.16.
2. Legacy `chooser.html` code changes — `war/js/*.js` untouched. Legacy continues to read `upgradeConstraints` directly.
3. S1.15 carry-over — 35 duplicate formation names in `traitor-titan-legions.json`. Separate cleanup; not blocking.
4. **S1.16 — parsed weapon stats** (AP/AT/MW codes). Would enable showing weapon stats in the chip popover. Listed as a follow-up.
5. **S1.17 — typed upgrade `kind`** (unit/weapon/config). Would smarten the migration's label heuristic and close the 67/156 profile-coverage gap. Follow-up.
6. Hand-curation of `"Choice"` labels for both swap_slots and loadout_slots — eventual UX polish PR.
7. Position identity / asymmetric defaults — positions are interchangeable; future schema extension if rulebook semantics need it.
8. Compound rules — "pick 2 weapons but at most 1 plasma" — needs additional primitives.
9. Inter-slot dependencies — slot A constrains slot B. Not in data; not modeled.
10. Faction-wide "max-N-per-army" constraints — live in `upgradeConstraints` with `perArmy: true`; remain ignored by the modern builder.
11. Stage-4 mobile — postponed per [[stage3-status]]; chip-popover UI is touch-friendly so it inherits naturally when stage 4 starts.

**Open questions to resolve in spec review:**

- Final name of the new field. Going with `loadout_slots[]`. Alternatives: `selection_slots[]`, `multi_slots[]`, `pick_slots[]`. "Loadout" is slightly weapon-biased but matches army-builder vocabulary; flag if a more neutral name reads better.
- Behavior when both `min` and `max` are unset on a slot. Spec allows it but flags in the validator. Confirm whether to forbid outright.

**Legacy chooser-html compatibility — confirmed decision (mirrors S3.16):**

`war/js/chooser.js` continues to read `upgradeConstraints`. Migration adds `loadout_slots[]` alongside, never removes the original constraints. Legacy users see identical behavior to today. The [[project-users]] no-blackout rule is preserved.

**Follow-up specs that reference this design:**

1. **Constraint enforcement in modern builder** — surfaces remaining un-migrated `formationConstraints` / `upgradeConstraints` in the yellow banner. Modest scope; high impact for full legacy parity.
2. **S1.16 — parsed weapons** — chip popover gains stat-line annotations (`Macro Gatling Blaster   30cm AP5+/AT5+`).
3. **S1.17 — typed upgrade kind + profile linking** — replaces fragile name-match with explicit catalog↔profile references.
4. **Label-curation pass** — per-faction hand-curated labels for both swap_slots and loadout_slots.
5. **Stage 4 mobile** — postponed; design assumes touch-friendly chips/popover work as-is when mobile starts.
