# Modern-Builder Constraint Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface every list-construction constraint violation the legacy `chooser.html` enforces (`formationConstraints` shapes: max/min/range/forEach/maxPercent/perPoints, plus the remaining unhandled `upgradeConstraints` particularly `perArmy:true` caps) in the modern builder via a refactored yellow banner + block-on-action button disabling + per-card destructive tint.

**Architecture:** A new pure-function module `apps/web/src/stores/constraints.ts` exports per-shape evaluators (`evalMax`, `evalMin`, `evalRange`, `evalForEach`, `evalMaxPercent`, `evalPerPoints`), a `BuildSnapshot` builder, and four coordinator functions (`evaluateAll`, `canAddFormation`, `canRemoveFormation`, `canAddUpgrade`, `canRemoveUpgrade`). The existing `violations()` in `selectors.ts` becomes a thin wrapper and the loadout-slot min-check moves into the new module so all violations come from one place. UI: banner formatter in `build.$listId.tsx` groups by scope; FormationCard tints when its `instance_id` is in any violation's `contributingInstanceIds`; Add/Remove buttons + upgrade checkboxes + loadout chip controls consult the `can*` functions and `disabled` + `title=` accordingly.

**Tech Stack:** Node `node:test` runner (NOT vitest), TypeScript, React, Zustand, TanStack Router, `tsx` for TS in node:test.

**Spec:** `docs/superpowers/specs/2026-05-30-constraint-enforcement-design.md` (commit `78c5549` — includes the per-card-tint amendment on top of the initial spec at `038539d`).

---

## Repo conventions you must know

- **Test runner:** `node --test --import tsx`. NOT vitest. Imports: `import { test, describe } from 'node:test'; import assert from 'node:assert';`.
- **Root `npm test`** runs api + web + tools workspaces.
- **Commit style:** lowercase imperative prefixes — `feat(web): …`, `test: …`, `refactor(web): …`. **No Co-Authored-By trailers** — the user rejects them in this project.
- **Flaky test:** `apps/api/src/__tests__/static-routes.test.ts` flakes on cold first runs (port-binding race). Re-run once before treating as a real failure.
- **TypeScript strictness:** the codebase compiles with `--noEmit`. Run `npm run typecheck --workspace apps/web` after touching shared types.

---

## File Map

**Create:**
- `apps/web/src/stores/constraints.ts` — pure evaluator + coordinator module (Tasks 1–9).
- `apps/web/src/stores/__tests__/constraints.test.ts` — unit tests for evaluators + coordinators (Tasks 2–10).
- `apps/web/src/stores/__tests__/constraints.real-data.test.ts` — smoke test that runs `evaluateAll` across all `war/lists/*.json` (Task 11).

**Modify:**
- `apps/web/src/stores/selectors.ts` — add `CatalogFormationConstraint` and `CatalogUpgradeConstraint` interfaces; extend `CatalogList` to expose them; rewrite `violations()` as a wrapper that delegates to `evaluateAll()` (Tasks 1, 10).
- `apps/web/src/routes/build.$listId.tsx` — banner formatter groups violations by scope + dedupes; formation picker "Add" buttons consult `canAddFormation`; formation card "×" consults `canRemoveFormation`; upgrade checkboxes consult `canAddUpgrade`/`canRemoveUpgrade`; `FormationCard` applies per-card destructive tint when its `instance_id` is in any violation's `contributingInstanceIds` (Tasks 12, 13, 14, 15).
- `apps/web/src/components/LoadoutSlotControl.tsx` — `LoadoutChip` and `AddLoadoutChip` consult `canAddUpgrade`/`canRemoveUpgrade` for the underlying variant upgrade (Task 14).

---

## Task 1: Catalog constraint types + constraints.ts skeleton

**Files:**
- Modify: `apps/web/src/stores/selectors.ts`
- Create: `apps/web/src/stores/constraints.ts`

- [ ] **Step 1: Add `CatalogFormationConstraint` and `CatalogUpgradeConstraint` interfaces to `selectors.ts`.**

Open `apps/web/src/stores/selectors.ts`. After the existing `CatalogLoadoutVariant` interface (around line 56), insert:

```typescript
/** Constraint on how many of which formation types can appear in the army.
 * Matches the loose shape of `war/lists/*.json`'s `formationConstraints[]`.
 * All fields are optional; the evaluator inspects which combination is present
 * to decide which rule shape to apply (max / min / range / forEach / maxPercent /
 * perPoints, possibly with perArmy scope). */
export interface CatalogFormationConstraint {
  name?: string;
  name2?: string;
  from?: number[];
  appliesTo?: number[];
  min?: number;
  max?: number;
  forEach?: number[];
  maxPercent?: number;
  perPoints?: number;
  perArmy?: boolean;
}

/** Constraint on how many of which upgrade ids can appear, scoped per-formation
 * by default or per-army when `perArmy: true`. `appliesTo` narrows which formation
 * types this constraint applies to. */
export interface CatalogUpgradeConstraint {
  name?: string;
  from?: number[];
  appliesTo?: number[];
  min?: number;
  max?: number;
  perArmy?: boolean;
  perPoints?: number;
}
```

- [ ] **Step 2: Extend `CatalogList` with optional constraint arrays.**

Find the existing `CatalogList` interface in the same file. Add two new optional fields:

```typescript
export interface CatalogList {
  list_id: string;
  faction_id?: string;
  ruleset?: string;
  sections: Array<{
    name: string;
    formations: CatalogFormation[];
  }>;
  upgrades?: CatalogUpgrade[];
  formationConstraints?: CatalogFormationConstraint[];  // NEW
  upgradeConstraints?: CatalogUpgradeConstraint[];      // NEW
}
```

- [ ] **Step 3: Create `apps/web/src/stores/constraints.ts` with the public type surface.**

The whole file at this point:

```typescript
/**
 * Constraint evaluator for the modern builder.
 *
 * Purpose: take a CatalogList + BuilderState and report every list-construction
 * constraint violation. Drives the yellow violation banner, the disable-on-action
 * checks for Add/Remove buttons, and the per-card destructive tint.
 *
 * Pure: no DOM, no React, no Zustand. Each `eval*` function takes plain inputs
 * and returns either `null` (ok) or a `ConstraintViolation`. The coordinators
 * (`evaluateAll`, `canAddFormation`, …) build a `BuildSnapshot` from the state
 * once per call and pass it to the per-shape evaluators.
 */

import type {
  BuilderState,
  BuilderFormation,
} from './builder-store';
import type {
  CatalogList,
  CatalogFormation,
  CatalogFormationConstraint,
  CatalogUpgradeConstraint,
} from './selectors';

export interface ConstraintViolation {
  message: string;
  constraint: CatalogFormationConstraint | CatalogUpgradeConstraint;
  /** Formation instance_ids that contribute to this violation. Used by the
   * FormationCard tint logic to highlight cards the user can act on. */
  contributingInstanceIds?: string[];
  severity?: 'warning' | 'info';
}

export interface ConstraintCheckResult {
  /** null = allowed; otherwise one or more rules block this action. */
  blockingReasons: ConstraintViolation[] | null;
}

// ===== Placeholder exports — implemented in later tasks =====

export function evaluateAll(_state: BuilderState, _catalog: CatalogList): ConstraintViolation[] {
  return [];
}

export function canAddFormation(_formationStringId: string, _state: BuilderState, _catalog: CatalogList): ConstraintCheckResult {
  return { blockingReasons: null };
}

export function canRemoveFormation(_instanceId: string, _state: BuilderState, _catalog: CatalogList): ConstraintCheckResult {
  return { blockingReasons: null };
}

export function canAddUpgrade(_upgradeStringId: string, _instanceId: string, _state: BuilderState, _catalog: CatalogList): ConstraintCheckResult {
  return { blockingReasons: null };
}

export function canRemoveUpgrade(_upgradeStringId: string, _instanceId: string, _state: BuilderState, _catalog: CatalogList): ConstraintCheckResult {
  return { blockingReasons: null };
}
```

- [ ] **Step 4: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 5: Tests still pass (no behavior change yet).**

Run: `npm test --workspace apps/web`
Expected: all 53 existing tests still pass.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/stores/selectors.ts apps/web/src/stores/constraints.ts
git commit -m "feat(web): scaffold constraints module with placeholder coordinator API"
```

---

## Task 2: `friendlyName` helper (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Create: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Write the failing tests.**

Create `apps/web/src/stores/__tests__/constraints.test.ts`:

```typescript
import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  friendlyName,
  type ConstraintViolation,
} from '../constraints';
import type { CatalogList } from '../selectors';

const sampleCatalog: CatalogList = {
  list_id: 'TEST',
  sections: [],
  upgrades: [
    { id: 10, string_id: 'paladin', name: 'Knight Paladin', cost_pts: 90 },
    { id: 11, string_id: 'errant', name: 'Knight Errant', cost_pts: 100 },
    { id: 12, string_id: 'baron', name: 'Baron', cost_pts: 200 },
    { id: 13, string_id: 'seneschal', name: 'Seneschal', cost_pts: 25 },
  ],
};

describe('friendlyName', () => {
  test('joins one upgrade name as-is', () => {
    assert.strictEqual(friendlyName([10], sampleCatalog), 'Knight Paladin');
  });

  test('joins two upgrade names with /', () => {
    assert.strictEqual(friendlyName([10, 11], sampleCatalog), 'Knight Paladin / Knight Errant');
  });

  test('truncates 3+ entries with ellipsis', () => {
    assert.strictEqual(friendlyName([10, 11, 12, 13], sampleCatalog), 'Knight Paladin / Knight Errant / …');
  });

  test('falls back to raw id when not in upgrades[]', () => {
    assert.strictEqual(friendlyName([99], sampleCatalog), '#99');
  });

  test('returns "unknown" on empty input', () => {
    assert.strictEqual(friendlyName([], sampleCatalog), 'unknown');
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: new tests FAIL with `friendlyName is not exported`.

- [ ] **Step 3: Implement `friendlyName` in `constraints.ts`.**

After the imports, add (before the placeholder coordinator functions):

```typescript
/**
 * Short human-readable label for a constraint's `from[]` array.
 *
 * Joins the first 2 upgrade or formation names with " / "; appends " / …" when
 * more than 2 entries are present. Falls back to "#id" for ids not in the catalog
 * and returns "unknown" for empty input. Used by message templates when the
 * constraint doesn't carry a `name` field.
 */
export function friendlyName(from: number[] | undefined, catalog: CatalogList): string {
  if (!from || from.length === 0) return 'unknown';
  const lookup = (id: number): string => {
    const up = catalog.upgrades?.find((u) => u.id === id);
    if (up) return up.name;
    for (const section of catalog.sections ?? []) {
      const f = section.formations.find((f) => f.id === id);
      if (f) return f.name;
    }
    return `#${id}`;
  };
  const names = from.slice(0, 2).map(lookup);
  if (from.length > 2) names.push('…');
  return names.join(' / ');
}
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: all 53 existing + 5 new = 58 tests pass.

- [ ] **Step 5: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): friendlyName helper for constraint message templates"
```

---

## Task 3: `BuildSnapshot` builder (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append failing tests.**

Append to `apps/web/src/stores/__tests__/constraints.test.ts`:

```typescript
import { buildSnapshot, type BuildSnapshot } from '../constraints';
import type { BuilderState } from '../builder-store';

function emptyBuilder(overrides: Partial<BuilderState> = {}): BuilderState {
  return {
    list_id: 'TEST',
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 3,
    formations: [],
    initFromCatalog: () => {},
    initFromSavedList: () => {},
    addFormation: () => {},
    removeFormation: () => {},
    toggleUpgrade: () => {},
    selectSwapVariant: () => {},
    setLoadoutPosition: () => {},
    appendLoadoutPosition: () => {},
    removeLoadoutPosition: () => {},
    setTitle: () => {},
    setPointsTarget: () => {},
    setIsPublic: () => {},
    setUserListId: () => {},
    reset: () => {},
    ...overrides,
  };
}

const richCatalog: CatalogList = {
  list_id: 'RICH',
  sections: [
    {
      name: 'CORE',
      formations: [
        { string_id: 'a', id: 1, name: 'Alpha', cost_pts: 100, upgrades: [10, 11] },
        { string_id: 'b', id: 2, name: 'Beta', cost_pts: 200, upgrades: [10] },
      ],
    },
  ],
  upgrades: [
    { id: 10, string_id: 'sword', name: 'Sword', cost_pts: 50 },
    { id: 11, string_id: 'shield', name: 'Shield', cost_pts: 25 },
  ],
};

describe('buildSnapshot', () => {
  test('empty army → zero counts and zero points', () => {
    const snap = buildSnapshot(emptyBuilder(), richCatalog);
    assert.deepStrictEqual(snap.allFormationIds, []);
    assert.deepStrictEqual(snap.allFormationStringIds, []);
    assert.strictEqual(snap.totalPts, 0);
    assert.strictEqual(snap.upgradesAcrossArmy.length, 0);
  });

  test('two formations + one upgrade → totals and parallel arrays', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'a', upgrade_string_ids: ['sword'] },
        { instance_id: 'i2', formation_string_id: 'b', upgrade_string_ids: [] },
      ],
    });
    const snap = buildSnapshot(state, richCatalog);
    assert.deepStrictEqual(snap.allFormationIds, [1, 2]);
    assert.deepStrictEqual(snap.allFormationStringIds, ['a', 'b']);
    assert.strictEqual(snap.totalPts, 100 + 50 + 200);
    assert.strictEqual(snap.ptsByFormationTypeId.get(1), 150);
    assert.strictEqual(snap.ptsByFormationTypeId.get(2), 200);
    assert.deepStrictEqual(snap.upgradesPerInstance.get('i1'), ['sword']);
    assert.deepStrictEqual(snap.upgradesAcrossArmy, ['sword']);
  });

  test('repeated formation type accumulates per-type points', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'a', upgrade_string_ids: [] },
        { instance_id: 'i2', formation_string_id: 'a', upgrade_string_ids: ['shield'] },
      ],
    });
    const snap = buildSnapshot(state, richCatalog);
    assert.deepStrictEqual(snap.allFormationIds, [1, 1]);
    assert.strictEqual(snap.ptsByFormationTypeId.get(1), 100 + 100 + 25);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: new tests FAIL with `buildSnapshot is not exported`.

- [ ] **Step 3: Implement `buildSnapshot` + the `BuildSnapshot` type in `constraints.ts`.**

After the `friendlyName` function and before the placeholder coordinators, add:

```typescript
/**
 * Pre-computed counts and totals derived from a BuilderState. Built once per
 * coordinator call and passed to every per-shape evaluator so they don't each
 * re-walk the formations array.
 */
export interface BuildSnapshot {
  /** Formation type ids in insertion order, with repeats. Length = formations.length. */
  allFormationIds: number[];
  /** Same length as allFormationIds; parallel array of string_ids. */
  allFormationStringIds: string[];
  /** Total points: sum of formation cost + selected upgrades + (swap deltas + loadout costs handled later). */
  totalPts: number;
  /** Points contribution per formation type id (summed across instances). */
  ptsByFormationTypeId: Map<number, number>;
  /** instance_id → array of upgrade string_ids selected on that instance. */
  upgradesPerInstance: Map<string, string[]>;
  /** Every selected upgrade string_id across all instances (with repeats — same upgrade on two instances appears twice). */
  upgradesAcrossArmy: string[];
}

export function buildSnapshot(state: BuilderState, catalog: CatalogList): BuildSnapshot {
  const allFormationIds: number[] = [];
  const allFormationStringIds: string[] = [];
  const ptsByFormationTypeId = new Map<number, number>();
  const upgradesPerInstance = new Map<string, string[]>();
  const upgradesAcrossArmy: string[] = [];
  let totalPts = 0;

  for (const inst of state.formations) {
    let def: CatalogFormation | undefined;
    for (const section of catalog.sections ?? []) {
      def = section.formations.find((f) => f.string_id === inst.formation_string_id);
      if (def) break;
    }
    if (!def) continue;

    const typeId = typeof def.id === 'number' ? def.id : -1;
    allFormationIds.push(typeId);
    allFormationStringIds.push(inst.formation_string_id);

    const basePts = def.cost_pts ?? def.pts ?? 0;
    let instancePts = basePts;

    for (const usid of inst.upgrade_string_ids) {
      const u = catalog.upgrades?.find((u) => u.string_id === usid);
      const upPts = u?.cost_pts ?? u?.pts ?? 0;
      instancePts += upPts;
      upgradesAcrossArmy.push(usid);
    }

    upgradesPerInstance.set(inst.instance_id, [...inst.upgrade_string_ids]);
    totalPts += instancePts;
    ptsByFormationTypeId.set(typeId, (ptsByFormationTypeId.get(typeId) ?? 0) + instancePts);
  }

  return {
    allFormationIds,
    allFormationStringIds,
    totalPts,
    ptsByFormationTypeId,
    upgradesPerInstance,
    upgradesAcrossArmy,
  };
}
```

**Note:** swap/loadout costs are NOT included in `totalPts` here yet. Task 10 reconciles this — `totalPts` from the snapshot needs to match `totalPoints()` from selectors.ts. For now, the placeholder is fine because no evaluator uses `totalPts` until Task 7+.

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 58 + 3 = 61 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): BuildSnapshot helper for constraint evaluator inputs"
```

---

## Task 4: `evalMax` / `evalMin` / `evalRange` (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append failing tests.**

Append:

```typescript
import { evalMax, evalMin, evalRange } from '../constraints';

const knightHouseholdConstraint = {
  from: [10, 11],
  min: 3,
  max: 6,
};

describe('evalMax', () => {
  test('returns null when count <= max', () => {
    assert.strictEqual(evalMax({ max: 1, from: [10] }, 0, false, richCatalog), null);
    assert.strictEqual(evalMax({ max: 1, from: [10] }, 1, false, richCatalog), null);
  });

  test('returns violation when count > max', () => {
    const v = evalMax({ max: 1, from: [10] }, 2, false, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /limited to 1.*have 2/i);
  });

  test('mentions "across the whole army" when perArmy', () => {
    const v = evalMax({ max: 3, from: [10] }, 4, true, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /across the whole army/i);
  });

  test('returns null when max is absent', () => {
    assert.strictEqual(evalMax({ from: [10] }, 100, false, richCatalog), null);
  });
});

describe('evalMin', () => {
  test('returns null when count >= min', () => {
    assert.strictEqual(evalMin({ min: 2, from: [10] }, 2, false, richCatalog), null);
  });

  test('returns violation when count < min', () => {
    const v = evalMin({ min: 2, from: [10] }, 1, false, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /at least 2.*have 1/i);
  });

  test('returns violation even on empty army (mandatory formation missing)', () => {
    const v = evalMin({ min: 1, from: [10] }, 0, false, richCatalog);
    assert.ok(v);
  });

  test('returns null when min is 0 or absent', () => {
    assert.strictEqual(evalMin({ min: 0, from: [10] }, 0, false, richCatalog), null);
    assert.strictEqual(evalMin({ from: [10] }, 0, false, richCatalog), null);
  });
});

describe('evalRange', () => {
  test('under min → min violation', () => {
    const v = evalRange(knightHouseholdConstraint, 2, false, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /at least 3/i);
  });

  test('in range → null', () => {
    assert.strictEqual(evalRange(knightHouseholdConstraint, 3, false, richCatalog), null);
    assert.strictEqual(evalRange(knightHouseholdConstraint, 5, false, richCatalog), null);
  });

  test('over max → max violation', () => {
    const v = evalRange(knightHouseholdConstraint, 7, false, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /limited to 6/i);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: new tests FAIL with `evalMax/evalMin/evalRange is not exported`.

- [ ] **Step 3: Implement.**

Append to `apps/web/src/stores/constraints.ts` (after `buildSnapshot`):

```typescript
type AnyConstraint = CatalogFormationConstraint | CatalogUpgradeConstraint;

/** Inner core for max-only and the max-portion of range/perArmy variants. */
export function evalMax(
  constraint: AnyConstraint,
  count: number,
  perArmy: boolean,
  catalog: CatalogList,
): ConstraintViolation | null {
  if (constraint.max == null) return null;
  if (count <= constraint.max) return null;
  const label = constraint.name ?? friendlyName(constraint.from, catalog);
  const scope = perArmy ? ' across the whole army' : '';
  return {
    message: `${label} is limited to ${constraint.max}${scope}; you have ${count}.`,
    constraint,
  };
}

/** Inner core for min-only and the min-portion of range. Fires even on empty
 * army so mandatory-formation requirements surface immediately. */
export function evalMin(
  constraint: AnyConstraint,
  count: number,
  perArmy: boolean,
  catalog: CatalogList,
): ConstraintViolation | null {
  if (constraint.min == null || constraint.min === 0) return null;
  if (count >= constraint.min) return null;
  const label = constraint.name ?? friendlyName(constraint.from, catalog);
  const scope = perArmy ? ' across the whole army' : '';
  return {
    message: `${label} requires at least ${constraint.min}${scope}; you have ${count}.`,
    constraint,
  };
}

/** Range = both min and max. Returns the more-relevant violation (min if under,
 * max if over, null in-range). Never both — only one bound can be violated. */
export function evalRange(
  constraint: AnyConstraint,
  count: number,
  perArmy: boolean,
  catalog: CatalogList,
): ConstraintViolation | null {
  const minHit = evalMin(constraint, count, perArmy, catalog);
  if (minHit) return minHit;
  return evalMax(constraint, count, perArmy, catalog);
}
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 61 + 11 = 72 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): evalMax / evalMin / evalRange constraint evaluators"
```

---

## Task 5: `evalForEach` (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append failing tests.**

Append:

```typescript
import { evalForEach } from '../constraints';

describe('evalForEach', () => {
  test('fromCount within max × forEachCount → null', () => {
    // max=1, forEachCount=2 → allowed=2; fromCount=2 → ok.
    const c = { max: 1, from: [571, 572], forEach: [566, 567], name: 'Centurio', name2: 'Core' };
    assert.strictEqual(evalForEach(c, 2, 2, richCatalog), null);
  });

  test('fromCount > max × forEachCount → violation', () => {
    const c = { max: 1, from: [571, 572], forEach: [566, 567], name: 'Centurio', name2: 'Core' };
    const v = evalForEach(c, 3, 2, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /Centurio.*1 per Core.*have 3.*only 2 are allowed.*2 qualifying/i);
  });

  test('forEachCount=0 with fromCount>0 → violation flagging 0 allowed', () => {
    const c = { max: 1, from: [571], forEach: [566, 567] };
    const v = evalForEach(c, 1, 0, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /only 0 are allowed.*0 qualifying formation/i);
  });

  test('forEachCount=0 with fromCount=0 → null', () => {
    const c = { max: 1, from: [571], forEach: [566, 567] };
    assert.strictEqual(evalForEach(c, 0, 0, richCatalog), null);
  });

  test('absent max → null', () => {
    const c = { from: [571], forEach: [566] };
    assert.strictEqual(evalForEach(c, 5, 0, richCatalog), null);
  });

  test('absent forEach → null', () => {
    const c = { max: 1, from: [571] };
    assert.strictEqual(evalForEach(c, 5, 0, richCatalog), null);
  });

  test('singular "formation" when forEachCount === 1', () => {
    const c = { max: 1, from: [571], forEach: [566] };
    const v = evalForEach(c, 2, 1, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /1 qualifying formation\b/);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: 7 new tests fail.

- [ ] **Step 3: Implement.**

Append to `apps/web/src/stores/constraints.ts`:

```typescript
/** "max N per K of forEach formations". E.g. "max 1 Centurio per Core Formation". */
export function evalForEach(
  constraint: CatalogFormationConstraint,
  fromCount: number,
  forEachCount: number,
  catalog: CatalogList,
): ConstraintViolation | null {
  if (constraint.max == null || !Array.isArray(constraint.forEach)) return null;
  const allowed = constraint.max * forEachCount;
  if (fromCount <= allowed) return null;
  const label = constraint.name ?? friendlyName(constraint.from, catalog);
  const denomLabel = constraint.name2 ?? friendlyName(constraint.forEach, catalog);
  const plural = forEachCount === 1 ? '' : 's';
  return {
    message: `${label} is limited to ${constraint.max} per ${denomLabel}; you have ${fromCount} but only ${allowed} are allowed (${forEachCount} qualifying formation${plural}).`,
    constraint,
  };
}
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 72 + 7 = 79 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): evalForEach evaluator (max N per K of denominator formations)"
```

---

## Task 6: `evalMaxPercent` and `evalPerPoints` (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append failing tests.**

Append:

```typescript
import { evalMaxPercent, evalPerPoints } from '../constraints';

describe('evalMaxPercent', () => {
  test('ptsFromGroup <= floor(totalPts * pct/100) → null', () => {
    // 25% of 1000 = 250 allowed
    assert.strictEqual(evalMaxPercent({ maxPercent: 25, from: [1] }, 0, 1000, richCatalog), null);
    assert.strictEqual(evalMaxPercent({ maxPercent: 25, from: [1] }, 249, 1000, richCatalog), null);
    assert.strictEqual(evalMaxPercent({ maxPercent: 25, from: [1] }, 250, 1000, richCatalog), null);
  });

  test('ptsFromGroup > allowed → violation', () => {
    const v = evalMaxPercent({ maxPercent: 25, from: [1] }, 251, 1000, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /25% of total points \(250 pts\).*251 pts/);
  });

  test('totalPts === 0 → null (short-circuit, no divide-by-zero)', () => {
    assert.strictEqual(evalMaxPercent({ maxPercent: 25, from: [1] }, 100, 0, richCatalog), null);
  });

  test('absent maxPercent → null', () => {
    assert.strictEqual(evalMaxPercent({ from: [1] }, 100, 1000, richCatalog), null);
  });
});

describe('evalPerPoints', () => {
  test('count <= max × floor(totalPts / perPoints) → null', () => {
    // max=1 perPoints=1000: 999 pts → allowed 0; 1000 → 1; 1999 → 1; 2000 → 2
    assert.strictEqual(evalPerPoints({ max: 1, perPoints: 1000, from: [1] }, 0, 999, richCatalog), null);
    assert.strictEqual(evalPerPoints({ max: 1, perPoints: 1000, from: [1] }, 1, 1000, richCatalog), null);
    assert.strictEqual(evalPerPoints({ max: 1, perPoints: 1000, from: [1] }, 1, 1999, richCatalog), null);
    assert.strictEqual(evalPerPoints({ max: 1, perPoints: 1000, from: [1] }, 2, 2000, richCatalog), null);
  });

  test('count > allowed → violation', () => {
    const v = evalPerPoints({ max: 1, perPoints: 1000, from: [1] }, 2, 1999, richCatalog);
    assert.ok(v);
    assert.match(v!.message, /1 per 1000 pts.*have 2.*only 1 are allowed.*1999 pts/);
  });

  test('absent max → null', () => {
    assert.strictEqual(evalPerPoints({ perPoints: 1000, from: [1] }, 100, 5000, richCatalog), null);
  });

  test('absent perPoints → null', () => {
    assert.strictEqual(evalPerPoints({ max: 1, from: [1] }, 100, 5000, richCatalog), null);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: 9 new tests fail.

- [ ] **Step 3: Implement.**

Append to `apps/web/src/stores/constraints.ts`:

```typescript
/** "max N% of total points". Points-based; floor's the allowed budget. */
export function evalMaxPercent(
  constraint: CatalogFormationConstraint,
  ptsFromGroup: number,
  totalPts: number,
  catalog: CatalogList,
): ConstraintViolation | null {
  if (constraint.maxPercent == null || totalPts === 0) return null;
  const allowedPts = Math.floor(totalPts * (constraint.maxPercent / 100));
  if (ptsFromGroup <= allowedPts) return null;
  const label = constraint.name ?? friendlyName(constraint.from, catalog);
  return {
    message: `${label} is limited to ${constraint.maxPercent}% of total points (${allowedPts} pts); you have ${ptsFromGroup} pts.`,
    constraint,
  };
}

/** "max N per K points". Scaling cap, integer-floored. */
export function evalPerPoints(
  constraint: AnyConstraint,
  count: number,
  totalPts: number,
  catalog: CatalogList,
): ConstraintViolation | null {
  if (constraint.max == null || constraint.perPoints == null) return null;
  const allowed = constraint.max * Math.floor(totalPts / constraint.perPoints);
  if (count <= allowed) return null;
  const label = constraint.name ?? friendlyName(constraint.from, catalog);
  return {
    message: `${label} is limited to ${constraint.max} per ${constraint.perPoints} pts; you have ${count} but only ${allowed} are allowed (army is ${totalPts} pts).`,
    constraint,
  };
}
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 79 + 9 = 88 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): evalMaxPercent + evalPerPoints (points-based constraint evaluators)"
```

---

## Task 7: `evaluateAll` coordinator + `contributingInstanceIds` attribution (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append failing tests.**

Append:

```typescript
import { evaluateAll } from '../constraints';

const constraintCatalog: CatalogList = {
  list_id: 'CONSTRAINED',
  sections: [
    {
      name: 'CORE',
      formations: [
        { string_id: 'core', id: 100, name: 'Core Squad', cost_pts: 100, upgrades: [10] },
        { string_id: 'orbital', id: 101, name: 'Orbital Support', cost_pts: 200, upgrades: [] },
      ],
    },
  ],
  upgrades: [
    { id: 10, string_id: 'hydra', name: 'Hydra', cost_pts: 50 },
  ],
  formationConstraints: [
    { max: 1, from: [101], name: 'Orbital Support' },
    { min: 1, from: [100], name: 'Core requirement' },
  ],
  upgradeConstraints: [
    { max: 3, from: [10], perArmy: true, name: 'Hydra cap', appliesTo: [100] },
  ],
};

describe('evaluateAll', () => {
  test('empty army → mandatory formation violation only', () => {
    const violations = evaluateAll(emptyBuilder(), constraintCatalog);
    assert.strictEqual(violations.length, 1);
    assert.match(violations[0]!.message, /Core requirement.*at least 1.*have 0/);
  });

  test('over formation max → violation with both instance_ids attributed', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i-core', formation_string_id: 'core', upgrade_string_ids: [] },
        { instance_id: 'i-orb-1', formation_string_id: 'orbital', upgrade_string_ids: [] },
        { instance_id: 'i-orb-2', formation_string_id: 'orbital', upgrade_string_ids: [] },
      ],
    });
    const violations = evaluateAll(state, constraintCatalog);
    const orbitalV = violations.find((v) => /Orbital Support is limited to 1/i.test(v.message));
    assert.ok(orbitalV, `expected an Orbital violation, got: ${JSON.stringify(violations.map(v => v.message))}`);
    assert.deepStrictEqual(orbitalV!.contributingInstanceIds?.sort(), ['i-orb-1', 'i-orb-2']);
  });

  test('perArmy upgrade cap exceeded → violation lists every instance carrying that upgrade', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
        { instance_id: 'i2', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
        { instance_id: 'i3', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
        { instance_id: 'i4', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
      ],
    });
    const violations = evaluateAll(state, constraintCatalog);
    const hydraV = violations.find((v) => /Hydra cap/.test(v.message));
    assert.ok(hydraV);
    assert.match(hydraV!.message, /limited to 3 across the whole army.*have 4/);
    assert.deepStrictEqual(hydraV!.contributingInstanceIds?.sort(), ['i1', 'i2', 'i3', 'i4']);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: existing tests still pass; new tests fail because the placeholder `evaluateAll` returns `[]`.

- [ ] **Step 3: Implement `evaluateAll`.**

Replace the placeholder `evaluateAll` in `constraints.ts` with:

```typescript
export function evaluateAll(state: BuilderState, catalog: CatalogList): ConstraintViolation[] {
  const snap = buildSnapshot(state, catalog);
  const violations: ConstraintViolation[] = [];

  // Formation-scoped constraints (always army-wide). For each, pick the evaluator
  // by which fields are present, attribute contributingInstanceIds to every
  // instance whose type id is in `from`.
  for (const c of catalog.formationConstraints ?? []) {
    if (!Array.isArray(c.from)) continue;
    const fromSet = new Set(c.from);
    const contributingInstanceIds: string[] = [];
    let count = 0;
    let ptsContrib = 0;
    for (let i = 0; i < snap.allFormationIds.length; i++) {
      const typeId = snap.allFormationIds[i]!;
      if (fromSet.has(typeId)) {
        count++;
        ptsContrib += snap.ptsByFormationTypeId.get(typeId) ?? 0;
        const inst = state.formations[i];
        if (inst) contributingInstanceIds.push(inst.instance_id);
      }
    }
    // Note: ptsContrib over-counts when the same type has multiple instances because
    // ptsByFormationTypeId is type-summed. We want per-instance points for percent.
    // Recompute as the per-type sum, counted once per type.
    let ptsPerType = 0;
    for (const typeId of fromSet) {
      ptsPerType += snap.ptsByFormationTypeId.get(typeId) ?? 0;
    }

    let v: ConstraintViolation | null = null;
    if (Array.isArray(c.forEach)) {
      const forEachSet = new Set(c.forEach);
      let forEachCount = 0;
      for (const typeId of snap.allFormationIds) {
        if (forEachSet.has(typeId)) forEachCount++;
      }
      v = evalForEach(c, count, forEachCount, catalog);
    } else if (c.maxPercent != null) {
      v = evalMaxPercent(c, ptsPerType, snap.totalPts, catalog);
    } else if (c.perPoints != null) {
      v = evalPerPoints(c, count, snap.totalPts, catalog);
    } else if (c.min != null && c.max != null) {
      v = evalRange(c, count, true, catalog);
    } else if (c.max != null) {
      v = evalMax(c, count, true, catalog);
    } else if (c.min != null) {
      v = evalMin(c, count, true, catalog);
    }

    if (v) {
      v.contributingInstanceIds = contributingInstanceIds;
      violations.push(v);
    }
  }

  // Upgrade-scoped constraints. Loop each constraint × each formation type
  // it applies to. `perArmy` flips scope to all formations.
  for (const c of catalog.upgradeConstraints ?? []) {
    if (!Array.isArray(c.from)) continue;
    const fromSet = new Set(
      (c.from ?? [])
        .map((id) => catalog.upgrades?.find((u) => u.id === id)?.string_id)
        .filter((s): s is string => !!s)
    );
    const appliesTo = c.appliesTo;

    if (c.perArmy) {
      const contributingInstanceIds: string[] = [];
      let count = 0;
      for (const inst of state.formations) {
        if (appliesTo) {
          const def = findFormationByStringId(catalog, inst.formation_string_id);
          if (!def || typeof def.id !== 'number' || !appliesTo.includes(def.id)) continue;
        }
        for (const usid of inst.upgrade_string_ids) {
          if (fromSet.has(usid)) {
            count++;
            if (!contributingInstanceIds.includes(inst.instance_id)) {
              contributingInstanceIds.push(inst.instance_id);
            }
          }
        }
      }
      const v = pickUpgradeEval(c, count, snap.totalPts, true, catalog);
      if (v) {
        v.contributingInstanceIds = contributingInstanceIds;
        violations.push(v);
      }
    } else {
      // Per-formation scope: evaluate once per instance whose type is in appliesTo.
      for (const inst of state.formations) {
        const def = findFormationByStringId(catalog, inst.formation_string_id);
        if (!def) continue;
        if (appliesTo && (typeof def.id !== 'number' || !appliesTo.includes(def.id))) continue;
        let count = 0;
        for (const usid of inst.upgrade_string_ids) {
          if (fromSet.has(usid)) count++;
        }
        const v = pickUpgradeEval(c, count, snap.totalPts, false, catalog);
        if (v) {
          v.contributingInstanceIds = [inst.instance_id];
          violations.push(v);
        }
      }
    }
  }

  return violations;
}

function pickUpgradeEval(
  c: CatalogUpgradeConstraint,
  count: number,
  totalPts: number,
  perArmy: boolean,
  catalog: CatalogList,
): ConstraintViolation | null {
  if (c.perPoints != null) return evalPerPoints(c, count, totalPts, catalog);
  if (c.min != null && c.max != null) return evalRange(c, count, perArmy, catalog);
  if (c.max != null) return evalMax(c, count, perArmy, catalog);
  if (c.min != null) return evalMin(c, count, perArmy, catalog);
  return null;
}
```

Add the missing import for `findFormationByStringId`:

```typescript
import {
  findFormationByStringId,
  type CatalogList,
  type CatalogFormation,
  type CatalogFormationConstraint,
  type CatalogUpgradeConstraint,
} from './selectors';
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 88 + 3 = 91 tests pass.

- [ ] **Step 5: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): evaluateAll coordinator with contributingInstanceIds attribution"
```

---

## Task 8: `canAddFormation` + `canRemoveFormation` (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append failing tests.**

Append:

```typescript
import { canAddFormation, canRemoveFormation } from '../constraints';

describe('canAddFormation', () => {
  test('returns null when not at max', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: [] },
      ],
    });
    const r = canAddFormation('orbital', state, constraintCatalog);
    assert.strictEqual(r.blockingReasons, null);
  });

  test('blocks when adding would exceed max', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: [] },
        { instance_id: 'i2', formation_string_id: 'orbital', upgrade_string_ids: [] },
      ],
    });
    const r = canAddFormation('orbital', state, constraintCatalog);
    assert.ok(r.blockingReasons);
    assert.match(r.blockingReasons![0]!.message, /Orbital Support is limited to 1/);
  });

  test('does not mutate input state', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: [] },
      ],
    });
    const before = JSON.parse(JSON.stringify(state.formations));
    canAddFormation('orbital', state, constraintCatalog);
    assert.deepStrictEqual(state.formations, before);
  });
});

describe('canRemoveFormation', () => {
  test('returns null when removal does not violate any min', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: [] },
        { instance_id: 'i2', formation_string_id: 'core', upgrade_string_ids: [] },
      ],
    });
    const r = canRemoveFormation('i1', state, constraintCatalog);
    assert.strictEqual(r.blockingReasons, null);
  });

  test('blocks when removal would drop below min', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: [] },
      ],
    });
    const r = canRemoveFormation('i1', state, constraintCatalog);
    assert.ok(r.blockingReasons);
    assert.match(r.blockingReasons![0]!.message, /Core requirement.*at least 1.*have 0/);
  });

  test('returns null when removing a non-existent instance', () => {
    const r = canRemoveFormation('ghost', emptyBuilder(), constraintCatalog);
    assert.strictEqual(r.blockingReasons, null);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: 6 new tests fail (placeholders return null always; the block tests will fail because they expect specific block messages).

- [ ] **Step 3: Implement.**

Replace the placeholder `canAddFormation` and `canRemoveFormation` in `constraints.ts` with:

```typescript
import { ulid } from 'ulid';

export function canAddFormation(
  formationStringId: string,
  state: BuilderState,
  catalog: CatalogList,
): ConstraintCheckResult {
  const def = findFormationByStringId(catalog, formationStringId);
  if (!def) return { blockingReasons: null };
  // Simulate by cloning the formations array with a new instance appended.
  const simulatedState: BuilderState = {
    ...state,
    formations: [
      ...state.formations,
      { instance_id: `__sim_${ulid()}`, formation_string_id: formationStringId, upgrade_string_ids: [] },
    ],
  };
  const before = new Set(evaluateAll(state, catalog).map(violationKey));
  const after = evaluateAll(simulatedState, catalog);
  const newOnes = after.filter((v) => !before.has(violationKey(v)));
  return { blockingReasons: newOnes.length > 0 ? newOnes : null };
}

export function canRemoveFormation(
  instanceId: string,
  state: BuilderState,
  catalog: CatalogList,
): ConstraintCheckResult {
  const instance = state.formations.find((f) => f.instance_id === instanceId);
  if (!instance) return { blockingReasons: null };
  const simulatedState: BuilderState = {
    ...state,
    formations: state.formations.filter((f) => f.instance_id !== instanceId),
  };
  const before = new Set(evaluateAll(state, catalog).map(violationKey));
  const after = evaluateAll(simulatedState, catalog);
  const newOnes = after.filter((v) => !before.has(violationKey(v)));
  return { blockingReasons: newOnes.length > 0 ? newOnes : null };
}

/** Stable key for a violation to dedupe before/after comparisons. Constraint
 * objects are referentially stable across simulated state clones (the catalog
 * isn't cloned), so identity + message is sufficient. */
function violationKey(v: ConstraintViolation): string {
  return `${v.message}`;
}
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 91 + 6 = 97 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): canAddFormation + canRemoveFormation block-on-action checks"
```

---

## Task 9: `canAddUpgrade` + `canRemoveUpgrade` (TDD)

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append failing tests.**

Append:

```typescript
import { canAddUpgrade, canRemoveUpgrade } from '../constraints';

describe('canAddUpgrade', () => {
  test('returns null when below perArmy cap', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
        { instance_id: 'i2', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
      ],
    });
    const r = canAddUpgrade('hydra', 'i1', state, constraintCatalog);
    assert.strictEqual(r.blockingReasons, null);
  });

  test('blocks when adding would exceed perArmy cap', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
        { instance_id: 'i2', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
        { instance_id: 'i3', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
      ],
    });
    const r = canAddUpgrade('hydra', 'i1', state, constraintCatalog);
    assert.ok(r.blockingReasons);
    assert.match(r.blockingReasons![0]!.message, /Hydra cap.*limited to 3 across the whole army.*4/);
  });
});

describe('canRemoveUpgrade', () => {
  test('returns null when removing would not violate any min', () => {
    const state = emptyBuilder({
      formations: [
        { instance_id: 'i1', formation_string_id: 'core', upgrade_string_ids: ['hydra'] },
      ],
    });
    const r = canRemoveUpgrade('hydra', 'i1', state, constraintCatalog);
    assert.strictEqual(r.blockingReasons, null);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: new tests fail (placeholders).

- [ ] **Step 3: Implement.**

Replace the placeholder `canAddUpgrade` and `canRemoveUpgrade` in `constraints.ts` with:

```typescript
export function canAddUpgrade(
  upgradeStringId: string,
  instanceId: string,
  state: BuilderState,
  catalog: CatalogList,
): ConstraintCheckResult {
  const simulatedState: BuilderState = {
    ...state,
    formations: state.formations.map((f) =>
      f.instance_id === instanceId
        ? { ...f, upgrade_string_ids: [...f.upgrade_string_ids, upgradeStringId] }
        : f
    ),
  };
  const before = new Set(evaluateAll(state, catalog).map(violationKey));
  const after = evaluateAll(simulatedState, catalog);
  const newOnes = after.filter((v) => !before.has(violationKey(v)));
  return { blockingReasons: newOnes.length > 0 ? newOnes : null };
}

export function canRemoveUpgrade(
  upgradeStringId: string,
  instanceId: string,
  state: BuilderState,
  catalog: CatalogList,
): ConstraintCheckResult {
  const simulatedState: BuilderState = {
    ...state,
    formations: state.formations.map((f) => {
      if (f.instance_id !== instanceId) return f;
      const idx = f.upgrade_string_ids.indexOf(upgradeStringId);
      if (idx < 0) return f;
      const next = [...f.upgrade_string_ids];
      next.splice(idx, 1);
      return { ...f, upgrade_string_ids: next };
    }),
  };
  const before = new Set(evaluateAll(state, catalog).map(violationKey));
  const after = evaluateAll(simulatedState, catalog);
  const newOnes = after.filter((v) => !before.has(violationKey(v)));
  return { blockingReasons: newOnes.length > 0 ? newOnes : null };
}
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 97 + 3 = 100 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "feat(web): canAddUpgrade + canRemoveUpgrade block-on-action checks"
```

---

## Task 10: Migrate loadout-min violation + rewrite `violations()` as wrapper

**Files:**
- Modify: `apps/web/src/stores/constraints.ts`
- Modify: `apps/web/src/stores/selectors.ts`
- Modify: `apps/web/src/stores/__tests__/constraints.test.ts`

- [ ] **Step 1: Append a failing test for loadout-min in the new module.**

Append to `constraints.test.ts`:

```typescript
describe('evaluateAll — loadout slot min violations (moved from selectors.ts)', () => {
  const loadoutCatalog: CatalogList = {
    list_id: 'LOADOUT',
    sections: [
      {
        name: 'CORE',
        formations: [
          {
            string_id: 'titan',
            id: 500,
            name: 'Warlord Titan',
            cost_pts: 700,
            upgrades: [],
            loadout_slots: [
              {
                string_id: 'weapons',
                label: 'Weapons',
                min: 2,
                max: 2,
                variants: [
                  { upgrade_id: 50, is_default: true },
                  { upgrade_id: 51 },
                ],
              },
            ],
          },
        ],
      },
    ],
    upgrades: [
      { id: 50, string_id: 'gatling', name: 'Gatling', cost_pts: 0 },
      { id: 51, string_id: 'plasma', name: 'Plasma', cost_pts: 50 },
    ],
  };

  test('reports "requires at least N selections" when positions < min', () => {
    const state = emptyBuilder({
      formations: [
        {
          instance_id: 'w1',
          formation_string_id: 'titan',
          upgrade_string_ids: [],
          loadout_choices: { weapons: ['plasma'] }, // only 1 position, min=2
        },
      ],
    });
    const violations = evaluateAll(state, loadoutCatalog);
    const v = violations.find((v) => /Weapons.*at least 2/.test(v.message));
    assert.ok(v, `expected weapons violation, got: ${JSON.stringify(violations.map(v => v.message))}`);
    assert.deepStrictEqual(v!.contributingInstanceIds, ['w1']);
  });
});
```

- [ ] **Step 2: Run tests; expect failure.**

Run: `npm test --workspace apps/web`
Expected: new test fails — `evaluateAll` doesn't check loadout slots yet.

- [ ] **Step 3: Move the loadout-min logic into `evaluateAll`.**

In `apps/web/src/stores/constraints.ts`, add this block at the END of `evaluateAll` (just before the final `return violations;`):

```typescript
  // Loadout-slot min violations (moved from selectors.ts violations() — single source of truth).
  for (const inst of state.formations) {
    const def = findFormationByStringId(catalog, inst.formation_string_id);
    if (!def) continue;
    for (const slot of def.loadout_slots ?? []) {
      if (typeof slot.min !== 'number' || slot.min === 0) continue;
      const positions = getLoadoutPositions(catalog, def, inst.loadout_choices, slot.string_id);
      if (!positions) continue;
      if (positions.length < slot.min) {
        const noun = slot.min === 1 ? 'selection' : 'selections';
        violations.push({
          message: `${def.name}: '${slot.label}' requires at least ${slot.min} ${noun} (currently ${positions.length}).`,
          constraint: { name: slot.label, min: slot.min, from: [] } as CatalogUpgradeConstraint,
          contributingInstanceIds: [inst.instance_id],
        });
      }
    }
  }
```

Add the missing import at the top of `constraints.ts`:

```typescript
import { findFormationByStringId, getLoadoutPositions, /* ...existing... */ } from './selectors';
```

- [ ] **Step 4: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: 100 + 1 = 101 tests pass.

- [ ] **Step 5: Rewrite `violations()` in `selectors.ts` as a thin wrapper.**

Open `apps/web/src/stores/selectors.ts`. Find the existing `violations()` function (line ~272) and replace ENTIRELY with:

```typescript
/**
 * Returns every active constraint violation message for the current builder state.
 * Delegates to constraints.evaluateAll(); the loadout-min check that used to live
 * here moved into that module so all violations come from one place.
 */
export function violations(state: BuilderState, catalog: CatalogList): string[] {
  const msgs: string[] = [];
  if (state.points_target != null) {
    const total = totalPoints(state, catalog);
    if (total > state.points_target) {
      msgs.push(`Over points target by ${total - state.points_target}.`);
    }
  }
  // Constraint violations are added via constraints.evaluateAll; we extract
  // their message strings here for backward compat. The richer formatter
  // (grouping, dedup, per-card tinting) lives in build.$listId.tsx now.
  for (const v of evaluateAll(state, catalog)) {
    msgs.push(v.message);
  }
  return msgs;
}
```

Add the import at the top of `selectors.ts`:

```typescript
import { evaluateAll } from './constraints';
```

- [ ] **Step 6: Run tests; expect pass.**

Run: `npm test --workspace apps/web`
Expected: all 101+ tests pass. The OLD loadout-min test in `selectors.test.ts` (`'violations — flags when current position count < min'`) should still pass because the message format is preserved.

- [ ] **Step 7: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 8: Commit.**

```bash
git add apps/web/src/stores/constraints.ts apps/web/src/stores/selectors.ts apps/web/src/stores/__tests__/constraints.test.ts
git commit -m "refactor(web): violations() delegates to constraints.evaluateAll (single source)"
```

---

## Task 11: Real-data smoke test

**Files:**
- Create: `apps/web/src/stores/__tests__/constraints.real-data.test.ts`

- [ ] **Step 1: Write the smoke test.**

```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateAll } from '../constraints';
import type { CatalogList } from '../selectors';
import type { BuilderState } from '../builder-store';

const LISTS_DIR = path.resolve(__dirname, '..', '..', '..', '..', '..', 'war', 'lists');

function emptyState(listId: string): BuilderState {
  return {
    list_id: listId,
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 3,
    formations: [],
    initFromCatalog: () => {},
    initFromSavedList: () => {},
    addFormation: () => {},
    removeFormation: () => {},
    toggleUpgrade: () => {},
    selectSwapVariant: () => {},
    setLoadoutPosition: () => {},
    appendLoadoutPosition: () => {},
    removeLoadoutPosition: () => {},
    setTitle: () => {},
    setPointsTarget: () => {},
    setIsPublic: () => {},
    setUserListId: () => {},
    reset: () => {},
  };
}

test('evaluateAll runs without throwing across every war/lists/*.json', () => {
  const entries = fs.readdirSync(LISTS_DIR).filter((f) => f.endsWith('.json'));
  assert.ok(entries.length >= 100, `expected many list files, found ${entries.length}`);
  for (const fname of entries) {
    let json: CatalogList;
    try {
      json = JSON.parse(fs.readFileSync(path.join(LISTS_DIR, fname), 'utf8')) as CatalogList;
    } catch {
      continue; // skip malformed JSON (the validator covers those separately)
    }
    const state = emptyState(json.list_id);
    let violations;
    try {
      violations = evaluateAll(state, json);
    } catch (err) {
      assert.fail(`evaluateAll threw on ${fname}: ${(err as Error).message}`);
    }
    assert.ok(Array.isArray(violations), `${fname}: expected violations array`);
    for (const v of violations) {
      assert.ok(typeof v.message === 'string', `${fname}: violation missing message`);
      assert.ok(v.constraint, `${fname}: violation missing constraint reference`);
    }
  }
});
```

- [ ] **Step 2: Run the new smoke test.**

Run: `npm test --workspace apps/web`
Expected: passes — every list evaluates cleanly. If any list throws, that's a real bug; investigate before continuing.

- [ ] **Step 3: Commit.**

```bash
git add apps/web/src/stores/__tests__/constraints.real-data.test.ts
git commit -m "test: real-data smoke for constraint evaluator across all 156 lists"
```

---

## Task 12: Banner refactor — group by scope + dedupe + (×N) collapse

**Files:**
- Modify: `apps/web/src/routes/build.$listId.tsx`

- [ ] **Step 1: Read the existing banner JSX.**

Open `apps/web/src/routes/build.$listId.tsx`. Find the violation banner (looks for `border-destructive/40 bg-destructive/10` near the `violationList` variable). It currently renders a flat `<ul>` over `violations()`'s string output.

- [ ] **Step 2: Replace the banner with the grouped formatter.**

Locate the current `violationList` definition (in `BuilderUI`) and the banner JSX. Update the imports at the top:

```typescript
import { evaluateAll, type ConstraintViolation } from '@/stores/constraints';
```

In `BuilderUI`, after the existing `const violationList = violations(builder, catalog);` line, ADD:

```typescript
const allViolations: ConstraintViolation[] = evaluateAll(builder, catalog);

// Group by scope. Army-wide: violations with no contributing instance OR with
// formationConstraint origin OR perArmy upgrade constraints. Per-formation:
// everything else, keyed by formation name (with ×N collapse for duplicates).
const armyWideMsgs: string[] = [];
if (builder.points_target != null) {
  const total = totalPoints(builder, catalog);
  if (total > builder.points_target) {
    armyWideMsgs.push(`Over points target by ${total - builder.points_target}.`);
  }
}

const perFormationByName = new Map<string, { msgs: string[]; count: number }>();
const seenArmyWide = new Set<string>();

for (const v of allViolations) {
  const instanceIds = v.contributingInstanceIds ?? [];
  const isPerFormation = instanceIds.length === 1;
  if (!isPerFormation) {
    if (!seenArmyWide.has(v.message)) {
      armyWideMsgs.push(v.message);
      seenArmyWide.add(v.message);
    }
    continue;
  }
  const inst = builder.formations.find((f) => f.instance_id === instanceIds[0]);
  if (!inst) continue;
  const def = catalog.sections.flatMap((s) => s.formations).find((f) => f.string_id === inst.formation_string_id);
  if (!def) continue;
  const key = def.name;
  const entry = perFormationByName.get(key) ?? { msgs: [], count: 0 };
  if (!entry.msgs.includes(v.message)) entry.msgs.push(v.message);
  entry.count++;
  perFormationByName.set(key, entry);
}
```

Replace the current banner JSX:

```tsx
{violationList.length > 0 && (
  <ul className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
    {violationList.map((v, i) => <li key={i}>• {v}</li>)}
  </ul>
)}
```

with:

```tsx
{(armyWideMsgs.length > 0 || perFormationByName.size > 0) && (
  <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
    {armyWideMsgs.length > 0 && (
      <>
        <p className="font-medium">Army-wide:</p>
        <ul className="mt-1 ml-4 space-y-0.5">
          {armyWideMsgs.map((m, i) => <li key={`aw-${i}`}>• {m}</li>)}
        </ul>
      </>
    )}
    {[...perFormationByName.entries()].map(([name, entry]) => {
      // Collapse "×N" only when the same formation NAME appears with same violations N times.
      const headerName = entry.count > entry.msgs.length ? `${name} (×${Math.ceil(entry.count / entry.msgs.length)})` : name;
      return (
        <div key={`fmt-${name}`} className={armyWideMsgs.length > 0 ? 'mt-2' : ''}>
          <p className="font-medium">{headerName}:</p>
          <ul className="mt-1 ml-4 space-y-0.5">
            {entry.msgs.map((m, i) => <li key={`pf-${name}-${i}`}>• {m}</li>)}
          </ul>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 4: Run tests.**

Run: `npm test --workspace apps/web`
Expected: all tests pass. The previously-existing `violationList` is still computed (for legacy callers if any) but the banner now reads from `allViolations`.

- [ ] **Step 5: Smoke-test the build.**

Run: `npm run build --workspace apps/web 2>&1 | tail -5`
Expected: green.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/routes/build.\$listId.tsx
git commit -m "feat(web): banner groups violations by scope with army-wide / per-formation sections"
```

---

## Task 13: Block-on-action — formation picker + formation card + upgrade checkboxes

**Files:**
- Modify: `apps/web/src/routes/build.$listId.tsx`

- [ ] **Step 1: Update imports.**

In `build.$listId.tsx`, extend the existing `@/stores/constraints` import:

```typescript
import {
  evaluateAll,
  canAddFormation,
  canRemoveFormation,
  canAddUpgrade,
  canRemoveUpgrade,
  type ConstraintViolation,
} from '@/stores/constraints';
```

- [ ] **Step 2: Disable formation picker "Add" buttons.**

Find the formation picker JSX (the section that renders `catalog.sections` with the "Add" Button per formation). Locate the line:

```tsx
<Button
  size="sm"
  variant="outline"
  disabled={!f.string_id}
  onClick={() => f.string_id && builder.addFormation(f.string_id)}
>
  Add
</Button>
```

Replace with:

```tsx
{(() => {
  const block = f.string_id ? canAddFormation(f.string_id, builder, catalog) : null;
  const blockedMsgs = block?.blockingReasons?.map(r => r.message) ?? [];
  const isBlocked = blockedMsgs.length > 0;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!f.string_id || isBlocked}
      title={isBlocked ? blockedMsgs.join('\n') : undefined}
      onClick={() => f.string_id && !isBlocked && builder.addFormation(f.string_id)}
    >
      Add
    </Button>
  );
})()}
```

- [ ] **Step 3: Disable formation card "×" Remove button.**

Find the existing Remove button in `FormationCard` (the `<Button … onClick={() => builder.removeFormation(instance.instance_id)} className="print:hidden">×</Button>` line). Replace with:

```tsx
{(() => {
  const block = canRemoveFormation(instance.instance_id, builder, catalog);
  const blockedMsgs = block?.blockingReasons?.map(r => r.message) ?? [];
  const isBlocked = blockedMsgs.length > 0;
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isBlocked}
      title={isBlocked ? blockedMsgs.join('\n') : undefined}
      onClick={() => !isBlocked && builder.removeFormation(instance.instance_id)}
      className="print:hidden"
    >×</Button>
  );
})()}
```

- [ ] **Step 4: Disable upgrade checkboxes.**

Find the `availableUpgrades.map((u) => …)` block in `FormationCard`. Inside the `<input type="checkbox" … />` JSX, expand the `disabled` and add `title=`:

```tsx
{availableUpgrades.map((u) => {
  const checked = u.string_id ? instance.upgrade_string_ids.includes(u.string_id) : false;
  const block = u.string_id
    ? (checked
      ? canRemoveUpgrade(u.string_id, instance.instance_id, builder, catalog)
      : canAddUpgrade(u.string_id, instance.instance_id, builder, catalog))
    : null;
  const blockedMsgs = block?.blockingReasons?.map(r => r.message) ?? [];
  const isBlocked = blockedMsgs.length > 0;
  return (
    <li key={u.id} className="text-sm">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={!u.string_id || isBlocked}
          title={isBlocked ? blockedMsgs.join('\n') : undefined}
          onChange={() => u.string_id && !isBlocked && builder.toggleUpgrade(instance.instance_id, u.string_id)}
          className="h-4 w-4 rounded border-input"
        />
        <span>
          {u.name}
          {(u.cost_pts ?? u.pts ?? 0) > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">+{u.cost_pts ?? u.pts ?? 0}</span>
          )}
        </span>
      </label>
    </li>
  );
})}
```

- [ ] **Step 5: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 6: Run tests.**

Run: `npm test --workspace apps/web`
Expected: 101 tests still pass.

- [ ] **Step 7: Build.**

Run: `npm run build --workspace apps/web 2>&1 | tail -5`
Expected: green.

- [ ] **Step 8: Commit.**

```bash
git add apps/web/src/routes/build.\$listId.tsx
git commit -m "feat(web): block-on-action wiring for picker Add / card Remove / upgrade checkboxes"
```

---

## Task 14: Block-on-action in `LoadoutSlotControl`

**Files:**
- Modify: `apps/web/src/components/LoadoutSlotControl.tsx`

- [ ] **Step 1: Add imports.**

Open `apps/web/src/components/LoadoutSlotControl.tsx`. Add:

```typescript
import { canAddUpgrade, canRemoveUpgrade } from '@/stores/constraints';
import { useBuilderStore } from '@/stores/builder-store';
```

(if `useBuilderStore` is already imported, skip that line)

- [ ] **Step 2: Wrap chip "×" remove with `canRemoveUpgrade`.**

In `LoadoutChip`, find the `<span role="button" … onClick={…removeLoadoutPosition…}>` that renders the `×` remove. Compute a `removeBlock` ABOVE that span:

```tsx
const builder = useBuilderStore();  // (already present — leave it)
const removeBlock = position
  ? canRemoveUpgrade(position, instanceId, useBuilderStore.getState(), {
      // need a catalog reference — see step 3 for how this is threaded
    } as any)
  : null;
```

This step is incomplete because the component currently doesn't have access to `catalog` — it gets `slot` + `formation` but not the whole catalog. Threading the catalog through:

- [ ] **Step 3: Thread `catalog` into `LoadoutChip` and `AddLoadoutChip`.**

The `LoadoutSlotControl` ALREADY receives `catalog`. Pass it down to `LoadoutChip` and `AddLoadoutChip`:

```tsx
{positions.map((pos, idx) => (
  <LoadoutChip
    key={`${slot.string_id}-${idx}`}
    slot={slot}
    catalog={catalog}
    instanceId={instanceId}
    position={pos}
    positionIndex={idx}
    isRemovable={positions.length > min}
    sourceJson={sourceJson}
  />
))}
{canAdd && (
  <AddLoadoutChip slot={slot} catalog={catalog} instanceId={instanceId} sourceJson={sourceJson} />
)}
```

(No props change — these already have `catalog`. Confirm by checking the existing component signature.)

- [ ] **Step 4: Add the can-checks to `LoadoutChip`.**

In `LoadoutChip`, immediately after the `const builder = useBuilderStore();` line, compute:

```tsx
const removeBlock = position
  ? canRemoveUpgrade(position, instanceId, builder, catalog)
  : null;
const removeBlocked = (removeBlock?.blockingReasons?.length ?? 0) > 0;
```

Then update the `isRemovable` test on the `×` span to also consider `!removeBlocked`:

```tsx
{(isRemovable && !removeBlocked) && (
  <span … >×</span>
)}
```

Inside the variant popover's per-variant `<button>`, add a can-add check:

```tsx
{slot.variants.map((v) => {
  const up = findUpgradeById(catalog, v.upgrade_id);
  if (!up?.string_id) return null;
  const checked = up.string_id === position;
  // Check whether choosing this variant would be blocked. The pick implies:
  // remove the current `position` variant, then add the new `up.string_id`.
  // Simplification: only check canAddUpgrade for the new variant — that catches
  // the per-army cap and the per-formation upgrade max. The remove side is
  // implicit because positions are interchangeable in the chip strip.
  const pickBlock = !checked && up.string_id !== position
    ? canAddUpgrade(up.string_id, instanceId, builder, catalog)
    : null;
  const pickBlocked = (pickBlock?.blockingReasons?.length ?? 0) > 0;
  const pickBlockedMsgs = pickBlock?.blockingReasons?.map(r => r.message) ?? [];
  const label = variantDeltaLabel(catalog, slot, up.string_id);
  const weapon = findWeaponByName(sourceJson, up.name);
  return (
    <li key={String(v.upgrade_id)}>
      <button
        type="button"
        disabled={pickBlocked}
        title={pickBlocked ? pickBlockedMsgs.join('\n') : undefined}
        onClick={() => {
          if (pickBlocked) return;
          builder.setLoadoutPosition(instanceId, slot.string_id, positionIndex, up.string_id!);
          setOpen(false);
        }}
        className={`flex w-full flex-col items-start rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-muted font-medium' : ''}`}
      >
        <span className="flex w-full items-center justify-between">
          <span>{up.name}</span>
          <span className="text-muted-foreground">{label}</span>
        </span>
        {weapon && (
          <span className="text-[10px]">
            <WeaponStatLine weapon={weapon} />
          </span>
        )}
      </button>
    </li>
  );
})}
```

- [ ] **Step 5: Add the can-add check to `AddLoadoutChip`.**

Same pattern: inside the variant popover's per-variant button:

```tsx
{slot.variants.map((v) => {
  const up = findUpgradeById(catalog, v.upgrade_id);
  if (!up?.string_id) return null;
  const block = canAddUpgrade(up.string_id, instanceId, builder, catalog);
  const blocked = (block?.blockingReasons?.length ?? 0) > 0;
  const blockedMsgs = block?.blockingReasons?.map(r => r.message) ?? [];
  const label = variantDeltaLabel(catalog, slot, up.string_id);
  const weapon = findWeaponByName(sourceJson, up.name);
  return (
    <li key={String(v.upgrade_id)}>
      <button
        type="button"
        disabled={blocked}
        title={blocked ? blockedMsgs.join('\n') : undefined}
        onClick={() => {
          if (blocked) return;
          builder.appendLoadoutPosition(instanceId, slot.string_id, up.string_id!);
          setOpen(false);
        }}
        className="flex w-full flex-col items-start rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex w-full items-center justify-between">
          <span>{up.name}</span>
          <span className="text-muted-foreground">{label}</span>
        </span>
        {weapon && (
          <span className="text-[10px]">
            <WeaponStatLine weapon={weapon} />
          </span>
        )}
      </button>
    </li>
  );
})}
```

- [ ] **Step 6: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 7: Run tests.**

Run: `npm test --workspace apps/web`
Expected: all 101 tests pass.

- [ ] **Step 8: Build.**

Run: `npm run build --workspace apps/web 2>&1 | tail -5`
Expected: green.

- [ ] **Step 9: Commit.**

```bash
git add apps/web/src/components/LoadoutSlotControl.tsx
git commit -m "feat(web): block-on-action wiring for loadout chip add/remove + variant pick"
```

---

## Task 15: Per-card destructive tint + final integration check

**Files:**
- Modify: `apps/web/src/routes/build.$listId.tsx`

- [ ] **Step 1: Memoize `evaluateAll` once in `BuilderUI` and thread to `FormationCard`.**

In `BuilderUI`, `allViolations` already exists (from Task 12). Pass it to each `FormationCard`:

```tsx
{builder.formations.map((inst) => (
  <FormationCard
    key={inst.instance_id}
    instance={inst}
    catalog={catalog}
    sourceJson={sourceQ.data ?? null}
    allViolations={allViolations}
  />
))}
```

- [ ] **Step 2: Update `FormationCard`'s props to accept `allViolations`.**

In the `FormationCard` function signature, add `allViolations: ConstraintViolation[]` to the props type:

```tsx
function FormationCard({
  instance,
  catalog,
  sourceJson,
  allViolations,
}: {
  instance: { instance_id: string; formation_string_id: string; upgrade_string_ids: string[]; swap_choices?: Record<string, string>; loadout_choices?: Record<string, string[]> };
  catalog: CatalogList;
  sourceJson: SourceJson | null;
  allViolations: ConstraintViolation[];
}) {
```

- [ ] **Step 3: Compute card violations + apply tint class.**

Inside `FormationCard`, after the `const def = …` check, add:

```tsx
const cardViolations = allViolations.filter((v) =>
  v.contributingInstanceIds?.includes(instance.instance_id)
);
const tinted = cardViolations.length > 0;
```

Find the outermost `<li className="rounded-md border bg-card p-3 break-inside-avoid">` and replace with:

```tsx
<li className={[
  'rounded-md border p-3 break-inside-avoid',
  tinted ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card',
].join(' ')}>
```

- [ ] **Step 4: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 5: Run all tests.**

Run: `npm test`
Expected: every workspace green. (Re-run once if `static-routes.test.ts` flakes.)

- [ ] **Step 6: Full typecheck.**

Run: `npm run typecheck && npm run typecheck --workspace apps/web`
Expected: both pass.

- [ ] **Step 7: Web build.**

Run: `npm run build --workspace apps/web`
Expected: succeeds.

- [ ] **Step 8: Commit.**

```bash
git add apps/web/src/routes/build.\$listId.tsx
git commit -m "feat(web): per-card destructive tint on formations contributing to violations"
```

- [ ] **Step 9: Manual smoke test (documented; not automated — for the human controller after merge + redeploy).**

Per the spec §5 manual smoke list:
1. Build a Skitarii list. Add 2 Centurio Ordinatus formations + 0 Core formations → banner shows the forEach violation; "Add Centurio" button disabled; both Centurio cards tint.
2. Add 1 Core formation → "Add Centurio" re-enables; Centurio cards lose tint.
3. Add an army-cap-violating upgrade (e.g. 4 Hydra when max is 3 across army) → banner shows the per-army cap violation; 4th Hydra checkbox disabled; every formation card carrying a Hydra is tinted.
4. Save at 2000 pts target with 2500 pts of formations → over-points violation in banner (no per-card tint).
5. Print preview should NOT show the banner (`print:hidden`, unchanged); per-card tints DO show in print (default).

---

## Out of scope for this plan (per spec §6)

- Server-side constraint enforcement (decided in brainstorming — client-side only).
- Auto-fix / repair flows.
- shadcn Tooltip primitive (uses plain `title=` for v1).
- Constraint metadata audit (filling in missing `name` fields is a separate data spec).
- Mandatory-formation auto-add UI affordance.
- Banner pagination/collapse for very long violation lists.
- Performance memoization beyond the snapshot pattern (YAGNI for now; revisit on profiling).
