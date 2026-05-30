# Modern-builder constraint enforcement — design

**Status:** Draft — pending user review
**Date:** 2026-05-30
**Builds on:** S3.16 (swap_slots, PR #37/#38), S3.17 (loadout_slots, PR #39/#40/#42), loadout UX polish (PR #41).

## Goal

Surface every list-construction constraint violation the legacy `chooser.html` enforces — `formationConstraints[]` (max, min, range, forEach, maxPercent, perPoints, perArmy variants) and the remaining un-handled `upgradeConstraints[]` (especially `perArmy:true` upgrade caps). The modern builder currently shows only "Over points target" in its yellow banner and lets users silently build invalid lists otherwise.

After this lands the modern builder reaches **full legacy parity** for constraint warnings: every violation appears in the banner, and "Add" / "Remove" buttons disable when their action would violate a rule (matching the legacy chooser's `canAdd*`/`canRemove*` block-on-action UX).

## Scope decisions

Four big decisions locked in during brainstorming:

1. **Full coverage** — every constraint shape in real data. Inventory: 9 distinct `formationConstraints` shapes (701 total) + 6 distinct `upgradeConstraints` shapes (3,153 total). No subset; no phased rollout.
2. **Warnings + block-on-action** — yellow-banner warnings AND disabled "Add"/"Remove" buttons with tooltips. Full legacy parity.
3. **Native TypeScript implementation** — new module `apps/web/src/stores/constraints.ts`. Per-shape pure evaluators. No legacy JS shimming.
4. **Client-side only** — server-side validation (`lists.save`) keeps validating body shape + swap/loadout semantics, but does NOT reject saves of constraint-violating lists. User can save drafts. Matches legacy.

## Architecture at a glance

- New `apps/web/src/stores/constraints.ts` module: pure evaluator functions for each constraint shape + coordinator functions for the four common queries (`evaluateAll`, `canAddFormation`, `canRemoveFormation`, `canAddUpgrade`, `canRemoveUpgrade`).
- Existing `violations()` in `selectors.ts` becomes a thin wrapper that delegates to `evaluateAll`. The current loadout-slot min-check moves into the new module for consistency.
- Yellow banner in `build.$listId.tsx` groups violations by scope (Army-wide vs per-formation) and dedupes within groups.
- Formation picker "Add" buttons, formation card "×" Remove buttons, and upgrade checkboxes consult the appropriate `can*` function and become `disabled` + show a `title=` tooltip when blocked.
- Loadout chip `×`/`+ Add` already had min/max awareness from S3.17; integrates with the new `can*` functions for upgrade-level constraints.

## 1. Constraint evaluator module

New file `apps/web/src/stores/constraints.ts`. Single responsibility: take catalog data + builder state, return constraint violations. No DOM, no React, no store coupling.

**Exported types:**

```ts
export interface ConstraintViolation {
  // What got violated, in actionable terms.
  message: string;
  // Which constraint produced this (for grouping/dedup in UI).
  constraint: CatalogFormationConstraint | CatalogUpgradeConstraint;
  // Formation instance_ids that contribute to this violation. Used by the
  // FormationCard tint logic in §3 to highlight cards the user can act on.
  // - Army-wide formation-count violations: every instance of the formation
  //   type(s) in `from`.
  // - forEach violations: instances of the constrained type, not the denominator.
  // - Per-army upgradeConstraint violations: every instance that selected the
  //   upgrade in question.
  // - Per-formation violations (loadout slot min, per-formation upgrade caps):
  //   the single offending instance.
  contributingInstanceIds?: string[];
  // Optional severity hint. For future use; defaults to 'warning'.
  severity?: 'warning' | 'info';
}

export interface ConstraintCheckResult {
  // null = allowed; otherwise one or more rules block this action.
  blockingReasons: ConstraintViolation[] | null;
}
```

**Core API:**

```ts
// Returns every currently-active violation. Includes loadout-slot min violations
// (the existing logic moves here from selectors.ts).
export function evaluateAll(state: BuilderState, catalog: CatalogList): ConstraintViolation[];

// Pre-action checks. Each returns either null (ok) or a list of blocking reasons.
export function canAddFormation(formationStringId: string, state: BuilderState, catalog: CatalogList): ConstraintCheckResult;
export function canRemoveFormation(instanceId: string, state: BuilderState, catalog: CatalogList): ConstraintCheckResult;
export function canAddUpgrade(upgradeStringId: string, instanceId: string, state: BuilderState, catalog: CatalogList): ConstraintCheckResult;
export function canRemoveUpgrade(upgradeStringId: string, instanceId: string, state: BuilderState, catalog: CatalogList): ConstraintCheckResult;
```

**Internal evaluators (not exported):** one per shape — `evalMax`, `evalMin`, `evalRange`, `evalForEach`, `evalMaxPercent`, `evalPerPoints`. Math + message template colocated. Defined in §4.

**Scope rule:**

- `perArmy: true` (or default for formationConstraints) → scope is all formations in the army.
- Absent on upgradeConstraints → scope is the upgrades on the specific formation instance.
- `appliesTo` further narrows: only formations whose id is in `appliesTo` are checked.

**Resilience:** the evaluator never throws on missing data — bad references silently drop (with `console.warn` in dev). Same pattern as loadout selectors.

## 2. Yellow banner integration

The existing `violations()` becomes a thin wrapper around `evaluateAll()`. The current loadout-min-check logic moves into the new module so all violations come from one place.

**Banner-side formatting** (in `apps/web/src/routes/build.$listId.tsx`):

The current banner renders a flat `<ul>` of strings. After this change, violations are grouped by scope to make a longer list scannable:

```
Army-wide:
  • Over points target by 50.
  • Too many Centurio Ordinatus Formations (max 1 per Core Formation, got 2 with 1 Core).
  • Hydra is limited to 3 across the whole army; you have 4.

Sagitarii Demi-Century:
  • Weapons: requires at least 2 selections (currently 1).
  • Too many Hydra upgrades on this formation (max 1, got 2).

Knight Household (×2):
  • Knights: requires at least 3 selections (currently 2).
```

**Grouping rules:**

- Army-wide bucket: points-target violations, `formationConstraints` violations, `upgradeConstraints` with `perArmy: true` violations.
- Per-formation buckets: per-instance violations (loadout/swap slot mins, per-formation upgrade caps), grouped by formation name.
- When the same formation type appears multiple times with the same violation, collapse to `(×N)`.

**Dedup:** a single constraint may produce one violation per affected formation. The evaluator returns them all; the banner formatter dedupes within a group by `constraint` reference + message text.

**Message templates** are colocated with each `eval*` function — keeps the rule definition + its human phrasing in one place.

**No banner-collapsing.** When `evaluateAll()` returns an empty array, the banner div is unrendered entirely (current behavior — preserved).

**Visual treatment unchanged.** Banner stays `border-destructive/40 bg-destructive/10`.

## 3. Block-on-action

Four button surfaces gain constraint-awareness:

**1. Formation picker "Add" buttons** (left column of `build.$listId.tsx`):

```tsx
{section.formations.map((f) => {
  const block = f.string_id ? canAddFormation(f.string_id, builder, catalog) : null;
  return (
    <li …>
      <span>{f.name} <span>{f.cost_pts ?? f.pts ?? 0} pts</span></span>
      <Button
        size="sm"
        variant="outline"
        disabled={!f.string_id || !!block?.blockingReasons}
        title={block?.blockingReasons?.map(r => r.message).join('\n')}
        onClick={() => f.string_id && builder.addFormation(f.string_id)}
      >
        Add
      </Button>
    </li>
  );
})}
```

**2. Formation card `×` Remove buttons** — same pattern with `canRemoveFormation`.

**3. Upgrade checkboxes** — disabled when `canAdd` (for unchecked) or `canRemove` (for checked) returns blockingReasons.

**4. Loadout chip `+ Add` button + `×` remove** — the existing `isRemovable` prop on `LoadoutChip` (currently just `positions.length > min`) generalizes to consult `canRemoveUpgrade`. The `+ Add` chip gains a similar `canAddUpgrade` check.

**Tooltip mechanism:** plain HTML `title=` attribute for v1 — accessible by default for screen readers, hover-on-desktop, OS-level mobile behavior. Avoids pulling in another shadcn primitive for short messages.

**Disabled visual:** Tailwind's `disabled:opacity-50 disabled:cursor-not-allowed` for buttons; default checkbox disabled style for inputs.

**Where the checks live:** all `can*` functions imported from `apps/web/src/stores/constraints.ts`. Call sites all in `build.$listId.tsx`.

**Per-card visual tint** (NEW — was originally out-of-scope, folded in):

Each `FormationCard` consults `evaluateAll(...)` (memoized one call up in `BuilderUI`) and checks whether its `instance.instance_id` appears in any violation's `contributingInstanceIds`. If yes, the card's outer `<li>` gets a destructive border + faint background tint:

```tsx
const cardViolations = allViolations.filter((v) =>
  v.contributingInstanceIds?.includes(instance.instance_id)
);
const tinted = cardViolations.length > 0;

<li className={[
  'rounded-md border bg-card p-3 break-inside-avoid',
  tinted ? 'border-destructive/40 bg-destructive/5' : '',
  'print:hidden:false',  // keep tint visible in print too — debatable; opt out if it's distracting on paper
].filter(Boolean).join(' ')}>
```

The tint surfaces *which* formations the user should act on, not just *that* the list is invalid. For per-army constraints (e.g. "max 3 Hydra across army; you have 4"), every formation carrying a Hydra upgrade is tinted — making it obvious where to subtract from.

**Print treatment:** the tint is also visible in print/PDF by default. If real users find this distracting on paper, change to `print:bg-transparent print:border-border` — but defaulting to "tint in print too" makes printed evidence-of-violation more readable.

**Loaded-invalid-list edge case:** when a saved list is already invalid, banner shows the violations on render. Remove buttons stay enabled (so the user can fix by removing). Add buttons that would worsen the violation stay disabled. Affected formation cards tint immediately. No "fix it" wizard. Same as legacy.

**Performance:** picker re-evaluates `canAddFormation` for every visible formation on every render — ~1,000 ops/render in big lists. Small; no memoization needed initially. If profiling shows it's a hotspot, wrap in `useMemo`.

## 4. Per-shape evaluator semantics

Each constraint shape gets its own internal evaluator. Inputs come from a precomputed snapshot.

**Snapshot shape (built once per `evaluateAll` / `canAdd*` call):**

```ts
interface BuildSnapshot {
  allFormationIds: number[];                  // type IDs of every formation instance, with repeats
  allFormationStringIds: string[];             // string_ids, same length (parallel arrays)
  totalPts: number;                            // sum of formation cost + upgrade costs + swap delta + loadout cost
  ptsByFormationTypeId: Map<number, number>;   // per-type contribution
  upgradesPerInstance: Map<string, string[]>;  // instanceId → string_ids of selected upgrades + resolved loadout positions
  upgradesAcrossArmy: string[];                // flat list across all instances
}
```

Built once; passed to every evaluator. Avoids O(N²) recomputation.

---

#### `evalMax(constraint, count) → ConstraintViolation | null`

```ts
if (constraint.max == null) return null;
if (count <= constraint.max) return null;
return {
  message: `${constraint.name ?? friendlyName(from)} is limited to ${constraint.max}${perArmy ? ' across the whole army' : ''}; you have ${count}.`,
  constraint,
};
```

#### `evalMin(constraint, count) → ConstraintViolation | null`

```ts
if (constraint.min == null || constraint.min === 0) return null;
if (count >= constraint.min) return null;
return {
  message: `${constraint.name ?? friendlyName(from)} requires at least ${constraint.min}${perArmy ? ' across the whole army' : ''}; you have ${count}.`,
  constraint,
};
```

For formationConstraints with `min:N` and no formations present, this fires even on an empty army — matches legacy "mandatory formations missing" behavior.

#### `evalRange(constraint, count) → ConstraintViolation | null`

Returns the more-relevant violation (min if under, max if over, null otherwise). Never both — only one bound is violated at a time.

#### `evalForEach(constraint, fromCount, forEachCount) → ConstraintViolation | null`

```ts
if (constraint.max == null || !Array.isArray(constraint.forEach)) return null;
const allowed = constraint.max * forEachCount;
if (fromCount <= allowed) return null;
return {
  message: `${constraint.name ?? friendlyName(from)} is limited to ${constraint.max} per ${constraint.name2 ?? friendlyName(forEach)}; you have ${fromCount} but only ${allowed} are allowed (${forEachCount} qualifying formation${forEachCount === 1 ? '' : 's'}).`,
  constraint,
};
```

**Edge case — zero qualifying formations:** when `forEachCount === 0`, allowed is 0. If `fromCount > 0`, message reflects "you have N but only 0 are allowed (0 qualifying Core Formations)."

#### `evalMaxPercent(constraint, ptsFromGroup, totalPts) → ConstraintViolation | null`

```ts
if (constraint.maxPercent == null || totalPts === 0) return null;
const allowedPts = Math.floor(totalPts * (constraint.maxPercent / 100));
if (ptsFromGroup <= allowedPts) return null;
return {
  message: `${constraint.name ?? friendlyName(from)} is limited to ${constraint.maxPercent}% of total points (${allowedPts} pts); you have ${ptsFromGroup} pts.`,
  constraint,
};
```

`totalPts === 0` short-circuits — avoids divide-by-zero and matches legacy (no flagging of empty lists as percent-violated).

#### `evalPerPoints(constraint, count, totalPts) → ConstraintViolation | null`

```ts
if (constraint.max == null || constraint.perPoints == null) return null;
const allowed = constraint.max * Math.floor(totalPts / constraint.perPoints);
if (count <= allowed) return null;
return {
  message: `${constraint.name ?? friendlyName(from)} is limited to ${constraint.max} per ${constraint.perPoints} pts; you have ${count} but only ${allowed} are allowed (army is ${totalPts} pts).`,
  constraint,
};
```

`Math.floor(totalPts / perPoints)` means a 1,999-pt army with `max:1 perPoints:1000` allows 1 instance, not 2. Matches legacy.

#### Scope rules

| Constraint kind | `perArmy: true` | Default scope |
|---|---|---|
| `formationConstraints` | (redundant, always army-wide) | army-wide |
| `upgradeConstraints` | army-wide (count across all formations' upgrades) | per-formation instance |

`appliesTo` further narrows the formations the constraint applies to.

#### Coordinator functions

`evaluateAll(state, catalog)`:
1. Build the snapshot once.
2. For each `formationConstraint` in the list catalog: pick its evaluator(s), run with the snapshot, collect violations.
3. For each formation instance, for each `upgradeConstraint` that `appliesTo` this formation's type: pick evaluators, run with per-instance OR army-wide scope, collect violations.
4. Add loadout-slot min violations (moved-in logic).
5. **Populate `contributingInstanceIds`** on each violation per the attribution rules in the `ConstraintViolation` doc (§1). Implementation: each evaluator returns the violation; the coordinator decorates with the instance_ids based on the constraint's `from` field + the formation-type/upgrade-string-id lookups already in the snapshot.
6. Return flat list (banner formatter groups + dedupes; FormationCard filters by instance_id for per-card tinting).

`canAddFormation(formationStringId, state, catalog)`:
1. Clone the snapshot adjusted "as if this formation were added".
2. Evaluate only the constraints touching that type id.
3. Return any new violations as `blockingReasons`.

`canRemoveFormation` / `canAddUpgrade` / `canRemoveUpgrade`: same pattern.

**Friendly name fallback** — when `constraint.name` is absent, `friendlyName(from)` produces a readable string by joining the first 2 upgrade/formation names from `from`, appending `…` if more. Avoids `[563, 564, 565]` showing as raw IDs.

## 5. Tests

Five surfaces, matched to existing project posture (node:test, no playwright, manual smoke for UI).

**1. Per-evaluator unit tests** (`apps/web/src/stores/__tests__/constraints.test.ts`):

One describe block per evaluator. Synthetic constraints + counts/points:
- `evalMax`: max=1 count=0/1/2 → null/null/violation; absent max → null.
- `evalMin`: min=2 count=0/1/2 → violation/violation/null; min=0 or absent → null.
- `evalRange`: under min, in range, over max — one violation each.
- `evalForEach`: max=1 forEach=[F1,F2] with various counts. Edge: forEachCount=0 with fromCount>0 → violation; forEachCount=0 with fromCount=0 → null.
- `evalMaxPercent`: 25% of 1000pts → 250 max; ptsFromGroup=0/249/250/251 → null/null/null/violation; totalPts=0 → null.
- `evalPerPoints`: max=1 perPoints=1000, totalPts=999/1000/1999/2000 → counts allowed 0/1/1/2.

Each negative asserts on message text via regex.

**2. Coordinator tests — `evaluateAll`**:

Minimal catalog fixture with mixed formation + upgrade constraints. Verify:
- Empty army → only `min`-based mandatory-formation violations.
- Adding formations until max is violated → violation appears.
- Mix of `perArmy` and per-formation upgrade caps surface correctly.
- Loadout-slot min violation still appears (the moved-in logic).
- Same constraint affecting multiple formations produces multiple violations (banner dedup is the banner's job).
- **`contributingInstanceIds` populated per the §1 attribution rules:**
  - Army-wide formation max=1 with 2 instances → violation includes both `instance_id`s.
  - Per-army upgrade cap exceeded → violation includes every instance carrying that upgrade.
  - Per-formation upgrade violation → violation includes only that one instance.
  - Loadout-slot min violation → violation includes only the owning instance.
  - forEach violation → violation includes constrained-type instances only (not the denominator).

**3. `canAdd*` / `canRemove*` block tests**:

Table-driven for each of the four `can*` functions. Confirms snapshot-cloning doesn't mutate the original state (deep-equal before/after).

**4. Real-data smoke** (`apps/web/src/stores/__tests__/constraints.real-data.test.ts`):

Iterates every `war/lists/*.json`, builds a minimal state with no formations, calls `evaluateAll(state, catalog)`. Asserts only that it doesn't throw. Catches crashes on edge cases in real data that synthetic fixtures wouldn't surface.

**5. Manual smoke test** (documented; not automated):

1. Build a Skitarii list. Add 2 Centurio Ordinatus formations + 0 Core formations → banner shows the forEach violation; "Add Centurio" button becomes disabled; **both Centurio formation cards get the destructive tint** (red border + faint bg).
2. Add 1 Core formation → "Add Centurio" re-enables; Centurio cards lose their tint.
3. Add an army-cap-violating upgrade (e.g. 4 Hydra when max is 3 across army) → banner shows the per-army cap violation; 4th Hydra checkbox is disabled; **every formation card carrying a Hydra is tinted**.
4. Save at 2000 pts target with 2500 pts → over-points violation in banner (no per-card tint — points-target violation isn't attributable to a specific formation).
5. Print preview should NOT show the banner (it's `print:hidden`, same as today). **Per-card tints DO show in print** by default (debatable; spec defaults to "visible in print" so the PDF surfaces issues).

**Out of scope for tests:**

- Playwright/Cypress UI automation.
- Per-faction constraint correctness (catalog data may have its own bugs; this spec doesn't audit those).
- Performance benchmarks.

**TDD discipline note for writing-plans phase:** Each per-shape evaluator is a small pure function with clear inputs/outputs. Red-green-per-task fits naturally.

## 6. Out of scope, known limitations, follow-ups

**Out of scope:**

1. **Server-side constraint enforcement.** Decided in brainstorming — client-side only.
2. **Auto-fix / repair flows.** User reads the banner, fixes manually.
3. **Constraint metadata audit.** Many constraints lack `name` fields, so `friendlyName(from)` falls back to upgrade/formation names. Improving constraint names is a separate data-cleanup spec.
5. **Mandatory-formation auto-add hint.** No "+ Add required X" button on empty lists. Banner just shows the missing requirement.
6. **shadcn Tooltip primitive.** Tooltips use plain `title=` for v1.
7. **Banner pagination/collapse.** Banner grows to fit.
8. **Performance memoization.** YAGNI for now; revisit on profiling.

**Known limitations:**

- **`friendlyName` verbosity.** Many-entry `from` arrays produce truncated labels. Fix: add `name` fields to constraint data (separate spec).
- **Loaded-invalid-list handling.** Buttons that would worsen the list stay disabled. No auto-correction.
- **`perArmy` assumes single Force.** If multi-Force composition ever lands, `perArmy` semantics need revisiting.

**Open questions for spec review:**

- **Message wording standard.** "is limited to N; you have M" vs alternatives. Worth a pass during review.
- **`friendlyName` truncation length.** Defaulting to 2 names + "…"; verify against real data during implementation.

**Follow-up specs:**

1. Constraint-aware UX polish — shadcn Tooltip primitive, banner refinements (red-tint on contributing formations is now in scope, see §3).
2. Mandatory-formations auto-add hint UI.
3. Constraint metadata audit — fill in missing `name` fields.
4. Stage-4 mobile — constraint UI is touch-compatible (disabled buttons + `title=` work on touch).
