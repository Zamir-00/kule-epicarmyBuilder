# Formation-level unit swap — design

**Status:** Draft — pending user review
**Date:** 2026-05-29
**Trigger:** Gryphonne IV Skitarii Demi-Century's gun-servitor ↔ rapier-laser-destroyer swap is not selectable in the modern builder. Audit shows ~20 source-json files describe similar swap rules across many factions.

## Goal

Introduce a first-class "swap slot" primitive that lets a formation declare alternative unit compositions (e.g., "5 Gun Servitors *or* 3 Rapier Laser Destroyers"), surface it as a toggle on the builder's formation card, and migrate as many existing legacy `upgradeConstraints` rows to this new shape as we cleanly can.

**Scope decision:** formation-level swaps only. Intra-unit weapon-loadout swaps ("any bolter may be replaced with a plasma gun") are a separate spec and need a structured unit-composition model that doesn't exist today.

## Why this matters

Today the builder's data model is purely additive — every entry in a formation's `upgrades[]` is a checkbox that adds to the formation. There's no concept of a *replacement*. The closest existing mechanism is `upgradeConstraints` with `{ min: 1, max: 1, from: [...] }`, used by the legacy `chooser-html` UI. The modern SPA ignores those constraints, so swap-style rules are invisible.

The Gryphonne IV data already shows the failure mode: upgrades `101` (5 Gun Servitors) and `102` (3 Rapier Laser Destroyers) exist with a `{min:1, max:1, from:[101,102], appliesTo:[567]}` constraint, but neither upgrade is listed in formation 567's `upgrades[]` array. The constraint can't even fire in the modern builder.

## Design at a glance

- New optional `swap_slots[]` array on each formation in `war/lists/*.json`.
- Variants reference existing entries in the top-level `upgrades[]` (no new top-level concept).
- Each slot has exactly one variant marked `is_default: true`. Adding a formation auto-selects the default.
- Builder renders each slot as a checkbox (2 variants) or radio group (3+) under a "Composition" subsection on the formation card.
- Saved-list body adds `swap_choices: Record<slot_string_id, variant_upgrade_string_id>` per formation instance, written only for non-default selections.
- Legacy `upgradeConstraints` rows that the new shape supersedes stay in the data file (legacy chooser-html still reads them); the migration script *adds* `swap_slots[]` rather than removing constraints, to preserve legacy enforcement.

## 1. Data model

Extend `schemas/list.schema.json` with an optional `swap_slots[]` on each formation:

```jsonc
// On a formation in war/lists/<list_id>.json:
{
  "string_id": "sagitarii_demi_century",
  "id": 567,
  "name": "Sagitarii Demi-Century",
  "pts": 250,
  "cost_pts": 250,
  "units": "5 Sagitarii units, 5 Gun Servitors",
  "upgrades": [103, 104, 113, 105, 214, 225, 226, ...],
  "swap_slots": [
    {
      "string_id": "support_unit",
      "label": "Support unit",
      "variants": [
        { "upgrade_id": 101, "is_default": true },
        { "upgrade_id": 102 }
      ]
    }
  ]
}
```

`variants[].upgrade_id` references an entry in the top-level `upgrades[]`. Each variant uses the referenced upgrade's `name` and `pts`/`cost_pts`. Slots are independent — multiple slots per formation are allowed.

**Schema validation rules:**

- `swap_slots[]` is optional.
- Each slot requires `string_id`, `label`, `variants[]` (length ≥ 2), and exactly one variant with `is_default: true`.
- Every variant's `upgrade_id` must resolve to a real row in the list's top-level `upgrades[]`.
- An upgrade referenced by any swap-slot variant must NOT also appear in the formation's plain `upgrades[]` array (prevents double-rendering as both a swap variant and a standalone checkbox).
- Within a formation's `swap_slots[]`, `string_id` values must be unique.

These rules catch the Gryphonne IV data-bug surface (constraint pointing at a formation whose `upgrades[]` doesn't include the variants) at validate-time.

## 2. Migration / backfill

A new script `tools/migrate-swaps.mjs` scans every `war/lists/*.json` and classifies each `upgradeConstraint` with `min == max == 1` and `from.length >= 2`:

- **Auto-apply (high confidence):** all `from` upgrades exist; none appear in the target formations' `upgrades[]`; all variants are 0-pt or share a single pts value. The script adds the corresponding `swap_slots[]` entry to each `appliesTo` formation. **The original constraint row is left in place** (see "Legacy chooser compatibility" below).
- **Manual review (medium):** mismatched pts among variants, or `from` includes upgrades that *are* in the formation's `upgrades[]` (means legacy data double-encoded). Script logs and skips; we fix by hand.
- **Skip (low):** malformed (`from` length < 2, missing `appliesTo`, etc.). Logged, untouched.

**Default-variant heuristic for auto-apply:** lowest-pts variant becomes the default; ties resolve to first listed. The chosen default is surfaced in the script's report so reviewers can override.

**Gryphonne IV reference case:** the `{from:[101,102], appliesTo:[567]}` constraint falls into "Manual review" because upgrades 101/102 aren't in formation 567's `upgrades[]`. We fix it by hand as the worked example in the implementation PR — adding the `swap_slot` to formation 567, and confirming via rulebook whether 566 (Skitarii Demi-Century) should also get it.

**Source-json gap audit:** the script also greps `war/source-json/*.json` for "may be replaced", "may be exchanged", "in place of" phrasing and emits a CSV (`file, line, raw_text_excerpt`) of swap rules that the list-data files never encoded. This drives follow-up data-entry PRs per faction — not part of this spec.

**Rollout discipline:**

- Migration script committed in the same PR as the schema change + builder UI.
- Run in dry-run mode against all 156 lists → human-review the report → commit resulting list-file edits in separate "swap data backfill" PRs per faction, so each is reviewable in isolation. Per [[project-users]] this avoids extended blackouts.
- Schema validation in CI catches malformed `swap_slots[]` on every PR.

## 3. Builder UI

Add a "Composition" subsection to `FormationCard` in `apps/web/src/routes/build.$listId.tsx`. Rendered above the existing additive-upgrade checkboxes, visually separated.

**Rendering rules:**

- For each `swap_slot` on the formation definition:
  - **2 variants** → single checkbox toggle, labeled with the *non-default* variant. Unchecked = default. (Most common case.)
    Example: `☐ Replace gun servitors with rapier laser destroyers (+0)`
  - **3+ variants** → radio group, one row per variant, default pre-selected. Wrapped in `<fieldset><legend>` for accessibility.
- Variant rows display the variant's `name` and the *delta vs. the default's pts* (e.g., `(+50)`, `(−25)`, or no badge when 0). Delta-not-absolute is what makes the swap legible at a glance.
- If a formation has no `swap_slots[]`, the Composition subsection is hidden — card looks identical to today.

**Points calculation** (`apps/web/src/stores/selectors.ts`):

For each formation instance, base cost = `def.cost_pts ?? def.pts`. For each `swap_slot` on the formation, add the *chosen* variant's pts and subtract the *default* variant's pts. New helper `swapDeltaForFormation(catalog, formation_def, swap_choices)`. Net effect: 0-pt swaps are no-ops; non-zero swaps add their delta.

**Print view:** for each `swap_slot`, print one line under the formation header showing the *currently selected* variant (e.g., `• Support unit: 3 Rapier Laser Destroyers`). Always print, not just when non-default — the PDF reader sees the complete loadout. Existing additive-upgrade print block is unchanged.

**Mockup (text):**

```
Sagitarii Demi-Century                250 pts
─────────────────────────────────────────────
Composition
  ▸ Support unit: ☑ Replace gun servitors
                    with rapier laser destroyers  (+0)
─────────────────────────────────────────────
Upgrades
  ☐ Hydra (+50)
  ☐ 10 Chimedons (+175)
  ☐ Magos Character (+50)
```

## 4. Saved-list body shape

Existing shape:

```json
{ "formations": [{ "instance_id": "...", "formation_string_id": "...", "upgrade_string_ids": [] }] }
```

New shape:

```jsonc
{
  "body_version": 2,
  "formations": [
    {
      "instance_id": "01HQ...",
      "formation_string_id": "sagitarii_demi_century",
      "upgrade_string_ids": ["hydra"],
      "swap_choices": {
        "support_unit": "3_rapier_laser_destroyer_unit"
      }
    }
  ]
}
```

- `swap_choices` is `Record<swap_slot_string_id, chosen_variant_upgrade_string_id>`.
- **Save-time:** entries are written *only* when the selection differs from the slot's default. Keeps payloads small and lets data-file default changes propagate sensibly.
- **Load-time:** missing `swap_choices` field or missing key → resolves to the slot's default. Existing `body_version: 1` lists load with all defaults, which equals "what the formation came with before this feature." Zero migration of saved data needed.
- **Stale-data:** if the catalog removed the slot or variant a saved list references, the loader silently drops the entry, console-warns once, and falls back to the default. No user-facing error.
- **`body_version`** is cosmetic safety for future iterations (intra-unit weapon swaps will write `3`). `1` or absent = legacy.

**Builder-store changes** (`apps/web/src/stores/builder-store.ts`):

- New action `selectSwapVariant(instance_id, slot_string_id, variant_upgrade_string_id)`. Sets the choice, or removes the key when the variant equals the slot's default.
- Read helper `getSwapChoice(formation_def, instance, slot_string_id)` returns the resolved variant `upgrade.string_id` (chosen or default).

**Server-side validation** (`apps/api/src/trpc/lists.ts → save`):

Extend the Zod schema for `body`. For each formation instance with `swap_choices`:

- Each key must be a real `swap_slot.string_id` on the referenced formation.
- Each value must be a valid variant's `upgrade.string_id` for that slot.
- `body_version`, if present, must be `1` or `2`.

Reject with `TRPCError({ code: 'BAD_REQUEST', message: '<field path>: <reason>' })`.

## 5. Validation and error handling

Three tiers:

**Tier 1 — Catalog schema validation (CI).** Extend `tools/validate-lists.js` to enforce the swap-slot rules from §1. Malformed list files fail CI; bad commits don't deploy.

**Tier 2 — Server-side `lists.save` validation.** As described in §4. Protects the DB from non-UI clients.

**Tier 3 — Client-side resilience.** Loader and render path never crash on catalog drift:

- Catalog removed a slot the saved list references → drop entry, console-warn, render with remaining slots' defaults.
- Catalog removed a variant the saved list chose → same: drop, warn, fall back to default.
- Catalog removed the formation entirely → existing "Unknown formation" warning row already handles this.

**Yellow violation banner — no new strings.** Every slot has a default, and the UI only allows valid selections, so the player can't reach an "incomplete swap" state. The points-target violation remains the only banner message. Broader `formationConstraints`/`upgradeConstraints` enforcement stays deferred (separate future spec).

**Known tech debt called out:** legacy `upgradeConstraints` rows that don't match the migration pattern stay in the data and continue to be ignored by the modern builder. Same as today — not new tech debt.

## 6. Tests

Five test surfaces, matched to existing stack (vitest at unit level, manual smoke for cross-cutting flows).

**Schema fixtures** (`schemas/__tests__/list.schema.test.ts`):
- Happy path passes.
- Missing `is_default`, two `is_default`, variant points to non-existent upgrade, upgrade in both `upgrades[]` and a variant, duplicate slot `string_id` — each fails with a debuggable error path.

**Migration-script tests** (`tools/__tests__/migrate-swaps.test.mjs`):
- High-confidence transform produces correct `swap_slots[]` and leaves the original constraint in place.
- Mismatched-pts variants → tier `medium`, skipped, report row emitted.
- Idempotency: running twice produces same output as once.
- Gryphonne IV bug case → classified `medium`, skipped, present in report.

**Store + selector tests** (`apps/web/src/stores/__tests__/selectors.test.ts`, extended):
- `totalPoints` with default unselected = today's total.
- `totalPoints` with non-default variant = `base + chosen.pts − default.pts`.
- `getSwapChoice` falls back to default when `swap_choices` is empty.
- `selectSwapVariant(default)` removes the key (Section 4 invariant).
- Saved list referencing a removed slot → silently drops, warns once.
- `body_version: 1` list loads unchanged.

**Server-side tRPC validation** (`apps/api/src/__tests__/lists-save.test.ts`):
- Valid `swap_choices` saves and round-trips.
- Invalid slot key → `BAD_REQUEST` with field path.
- Invalid variant value → `BAD_REQUEST`.
- Unknown `body_version` → `BAD_REQUEST`.

**Manual smoke test** (documented; not automated):
1. Load `Gryphonne IV Skitarii Legion`.
2. Add `Sagitarii Demi-Century` → 250 pts.
3. Verify "Composition: Replace gun servitors…" toggle appears, unchecked, 250 pts.
4. Tick toggle → composition flips, points stay 250 (delta is 0).
5. Save → reload → toggle still checked.
6. Print preview → output shows "Support unit: 3 Rapier Laser Destroyers".

**Out of scope for tests:**
- Playwright/Cypress automation — not in stage-3's stack.
- Visual regression — covered by manual smoke + existing print test.
- Backfill correctness across 156 lists — each backfill PR gets its own manual review.

**TDD discipline note for writing-plans phase:** the migration script and selector logic in particular benefit from red-green-per-task — the fixture set above *is* the spec for "what right looks like."

## 7. Out of scope and follow-ups

**Out of scope:**

1. Intra-unit weapon-loadout swaps. Separate spec; will use `body_version: 3`.
2. General `formationConstraints` / `upgradeConstraints` enforcement in the modern builder. Today's behavior unchanged.
3. Backfilling source-json swap rules (the CSV the migration script emits) into list data. Per-faction data entry follow-up PRs.
4. Per-faction data correctness across all 156 lists. Backfill PRs land incrementally; spec ships with Gryphonne IV as the reference case.
5. Stage-4 (mobile). Postponed per [[stage3-status]].

**Legacy chooser-html compatibility — confirmed decision:**

`war/js/Force.js`, `ArmyList.js`, and `chooser.js` *do* consume `upgradeConstraints` / `formationConstraints`. Per [[project-users]], legacy UI must keep working. The chosen approach: **migration script ADDS `swap_slots[]`, does NOT REMOVE the corresponding `upgradeConstraints` row.** Both shapes coexist in the data file. Legacy chooser keeps reading constraints; modern builder reads `swap_slots`. Redundant on disk; zero risk to legacy users.

A future "legacy chooser parity" spec could patch `war/js/chooser.js` to also understand `swap_slots[]` and then we could deduplicate. Out of scope here.

**Follow-up specs that will reference this design:**

1. Intra-unit weapon-loadout swap (`body_version: 3`).
2. Constraint enforcement in modern builder.
3. Backfill: source-json swap rules → list data (tracked as issues, not a single spec).
