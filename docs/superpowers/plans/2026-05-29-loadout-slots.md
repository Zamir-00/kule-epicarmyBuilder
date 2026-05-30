# Formation Loadout Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `loadout_slots[]` primitive that models "formation includes N copies of a unit, each independently picks its weapon/variant from M options, repeats allowed" — covering 930 `upgradeConstraints` rows with `min/max != 1` (Warlord Titan weapons, Ordinatus Minorus units, Custodes detachments, etc.) and reaching full legacy parity for the dominant rulebook pattern.

**Architecture:** Optional `loadout_slots[]` field on each formation in `war/lists/*.json`, sibling to S3.16's `swap_slots[]`. Variants reference existing entries in the top-level `upgrades[]`. Saved-list body bumps to `body_version: 3` with a per-instance `loadout_choices: Record<slot_string_id, variant_string_id[]>`. Builder UI renders chip strips with click-popovers under the existing "Composition" subsection. Legacy `upgradeConstraints` rows that map to loadout slots stay in the data — migration adds `loadout_slots[]` alongside, preserving the legacy `chooser.html` enforcement path.

**Tech Stack:** Node `node:test` runner (NOT vitest), TypeScript, Zod, Drizzle, Fastify + tRPC, React + Zustand, TanStack Router, JSON Schema (draft-07), better-sqlite3, `tsx` for TS in node:test, **shadcn Popover primitive (new — installed in Task 6)**.

**Spec:** `docs/superpowers/specs/2026-05-29-loadout-slots-design.md` (commit `3383f21`).

---

## Repo conventions you must know

- **Test runner:** `node --test --import tsx`. NOT vitest. Imports: `import { test, describe } from 'node:test'; import assert from 'node:assert';`. Existing `apps/web` and `tools/test` are already wired into the root `npm test` (set up in S3.16 commit `7f276ea`).
- **Commit style:** lowercase imperative prefixes — `feat(web): …`, `feat(api): …`, `feat(data): …`, `feat(tools): …`, `feat(schema): …`, `test: …`, `chore: …`. **No Co-Authored-By trailers** — the user explicitly rejects them in this project.
- **Path conventions in code:** API uses `WAR_ROOT` from `apps/api/src/paths.js` to reach `war/lists/`. Don't hardcode.
- **Flaky test:** `apps/api/src/__tests__/static-routes.test.ts` flakes ~1-in-2 on cold first runs (port-binding race). Re-run once before treating as a real failure.
- **TypeScript strictness:** root and web both run `tsc --noEmit`. Run `npm run typecheck` from the worktree root after touching shared types.

---

## File Map

**Create:**
- `apps/web/src/components/ui/popover.tsx` — shadcn Popover primitive (installed in Task 6).
- `apps/web/src/components/LoadoutSlotControl.tsx` — chip strip + variant popover + `+ Add` button.
- `tools/test/fixtures/loadout-slots/happy.json` — positive fixture, `min=max=2` + default.
- `tools/test/fixtures/loadout-slots/happy-open.json` — positive, `max=3` no default.
- `tools/test/fixtures/loadout-slots/happy-range.json` — positive, `min=2 max=4` + default.
- `tools/test/fixtures/loadout-slots/min-greater-than-max.json` — negative.
- `tools/test/fixtures/loadout-slots/two-defaults.json` — negative.
- `tools/test/fixtures/loadout-slots/variant-not-in-upgrades.json` — negative.
- `tools/test/fixtures/loadout-slots/variant-also-in-formation-upgrades.json` — negative.
- `tools/test/fixtures/loadout-slots/variant-also-in-swap-slot.json` — negative (cross-system).
- `tools/test/fixtures/loadout-slots/duplicate-string-id-cross-system.json` — negative (cross-system).
- `tools/test/fixtures/loadout-slots/empty-variants.json` — negative.
- `tools/migrate-loadouts.mjs` — migration script with tiered classification.
- `tools/test/migrate-loadouts.test.js` — node:test for the migration transform.
- `tools/test/fixtures/migrate-loadouts/` — fixtures for the migration tests (5+ files).

**Modify:**
- `schemas/list.schema.json` — add `loadout_slots[]` shape and field validation rules.
- `schemas/types.ts` — regenerated via `node tools/generate-types.js`.
- `tools/validate-lists.mjs` — extend semantic-check block with loadout-slot rules + cross-system checks.
- `tools/test/validate-lists.test.js` — add tests for positive + negative fixtures.
- `apps/web/src/stores/selectors.ts` — types (`CatalogLoadoutSlot`, `CatalogLoadoutVariant`), helpers (`getLoadoutPositions`, `loadoutCostForFormation`, `canonicalizeLoadoutChoices`), update `totalPoints`, update `violations` for the "min not satisfied" message.
- `apps/web/src/stores/builder-store.ts` — `BuilderFormation.loadout_choices`, three new actions (`setLoadoutPosition`, `appendLoadoutPosition`, `removeLoadoutPosition`), bump `body_version` to 3 in `initFromCatalog` + `reset`.
- `apps/web/src/stores/__tests__/selectors.test.ts` — tests for the new helpers + store actions + violation message.
- `apps/web/package.json` — add `@radix-ui/react-popover` dep.
- `apps/web/src/routes/build.$listId.tsx` — render `<LoadoutSlotControl />` rows under "Composition"; canonicalize on save.
- `apps/web/src/routes/list.$id.tsx` — read-only loadout rendering in `FormationViewRow` (screen + print).
- `apps/api/src/trpc/lists.ts` — extend Zod body schema (`loadout_choices`, `body_version: 1|2|3`), semantic walk for loadout_choices.
- `apps/api/src/__tests__/integration/lists.test.ts` — add loadout-validation tests + body_version round-trip.
- `war/lists/AMTL_Adeptus_Titanicus_EPICUK.json` — worked reference case: apply loadout migration to 1-2 specific Titan formations (surgical; see Task 11 for the exact constraint to target).

---

## Task 1: Add `loadout_slots[]` shape to JSON Schema + 3 positive fixtures

**Files:**
- Modify: `schemas/list.schema.json`
- Create: `tools/test/fixtures/loadout-slots/happy.json`
- Create: `tools/test/fixtures/loadout-slots/happy-open.json`
- Create: `tools/test/fixtures/loadout-slots/happy-range.json`

- [ ] **Step 1: Extend `schemas/list.schema.json` to define `loadout_slots[]` on a formation.**

Open the file and locate the formation `properties` block (the same area touched by S3.16 Task 1, around where `swap_slots` is defined). After the closing brace of the `swap_slots` property block, ADD a sibling `loadout_slots` property. Use Edit to insert the following BEFORE the `}` that closes the formation's `properties` object — anchor on the existing `swap_slots` block end.

Replace this anchor (the closing of `swap_slots`):

```json
                  }
                }
              }
            }
          }
        }
      }
    },
```

with the same closing of swap_slots PLUS the new `loadout_slots` field:

```json
                  }
                }
              }
            }
          }
        },
                "loadout_slots": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["string_id", "label", "variants"],
                    "additionalProperties": true,
                    "properties": {
                      "string_id": { "type": "string", "minLength": 1 },
                      "label": { "type": "string", "minLength": 1 },
                      "min": { "type": "integer", "minimum": 0 },
                      "max": { "type": "integer", "minimum": 1 },
                      "variants": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                          "type": "object",
                          "required": ["upgrade_id"],
                          "additionalProperties": true,
                          "properties": {
                            "upgrade_id": {
                              "oneOf": [
                                { "type": "integer" },
                                { "type": "string" }
                              ]
                            },
                            "is_default": { "type": "boolean" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
```

**Note:** the JSON Schema cannot express "exactly one variant has `is_default: true`" or cross-references to `upgrades[]` or `swap_slot.variants[]`. Those rules go into `tools/validate-lists.mjs` semantic checks in Task 2.

If the Edit fails because the exact closing brace pattern isn't unique, open the file and use a longer anchor that includes 2-3 lines of context above `swap_slots`'s closing braces.

- [ ] **Step 2: Create `tools/test/fixtures/loadout-slots/happy.json` (`min=max=2` + default).**

```json
{
  "id": "TEST_loadout_happy",
  "list_id": "TEST_loadout_happy",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "warlord_titan",
          "id": 1,
          "name": "Warlord Battle Titan",
          "pts": 725,
          "cost_pts": 725,
          "upgrades": [],
          "loadout_slots": [
            {
              "string_id": "weapons",
              "label": "Weapons",
              "min": 2,
              "max": 2,
              "variants": [
                { "upgrade_id": 50, "is_default": true },
                { "upgrade_id": 51 },
                { "upgrade_id": 52 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 50, "string_id": "macro_gatling_blaster", "name": "Macro Gatling Blaster", "pts": 0 },
    { "id": 51, "string_id": "sunfury_plasma_annihilator", "name": "Sunfury Plasma Annihilator", "pts": 50 },
    { "id": 52, "string_id": "arioch_power_claw", "name": "Arioch Power Claw", "pts": 25 }
  ]
}
```

- [ ] **Step 3: Create `tools/test/fixtures/loadout-slots/happy-open.json` (`max=3`, no default).**

```json
{
  "id": "TEST_loadout_open",
  "list_id": "TEST_loadout_open",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "guard_inf",
          "id": 1,
          "name": "Infantry Company",
          "pts": 200,
          "cost_pts": 200,
          "upgrades": [],
          "loadout_slots": [
            {
              "string_id": "support",
              "label": "Support upgrades",
              "max": 3,
              "variants": [
                { "upgrade_id": 100 },
                { "upgrade_id": 101 },
                { "upgrade_id": 102 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 100, "string_id": "hydra", "name": "Hydra", "pts": 50 },
    { "id": 101, "string_id": "chimedons", "name": "Chimedons", "pts": 175 },
    { "id": 102, "string_id": "manticore", "name": "Manticore", "pts": 100 }
  ]
}
```

- [ ] **Step 4: Create `tools/test/fixtures/loadout-slots/happy-range.json` (`min=2 max=4` + default).**

```json
{
  "id": "TEST_loadout_range",
  "list_id": "TEST_loadout_range",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "custodes_det",
          "id": 1,
          "name": "Custodes Detachment",
          "pts": 350,
          "cost_pts": 350,
          "upgrades": [],
          "loadout_slots": [
            {
              "string_id": "squads",
              "label": "Custodes squads",
              "min": 2,
              "max": 4,
              "variants": [
                { "upgrade_id": 200, "is_default": true },
                { "upgrade_id": 201 },
                { "upgrade_id": 202 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 200, "string_id": "custodian_guard", "name": "Custodian Guard", "pts": 0 },
    { "id": 201, "string_id": "aquilon_terminators", "name": "Aquilon Terminators", "pts": 25 },
    { "id": 202, "string_id": "sagittarum_custodes", "name": "Sagittarum Custodes", "pts": 15 }
  ]
}
```

- [ ] **Step 5: Sanity-check the schema accepts the fixtures AND existing lists still validate.**

Run: `node tools/validate-lists.mjs`
Expected: `OK: 156 files` (the new `loadout_slots[]` field is optional; existing files have no slots and pass unchanged).

Then validate the three new fixtures individually using the validator API. Use an inline node command:

```bash
node -e "
const {validateListFile}=await import('./tools/validate-lists.mjs');
for (const f of ['happy', 'happy-open', 'happy-range']) {
  const r = await validateListFile('./tools/test/fixtures/loadout-slots/'+f+'.json');
  console.log(f, r.ok ? 'OK' : 'FAIL', r.errors||[]);
}
" --input-type=module
```

Expected: all three say `OK []`. (Semantic rules like "at most one default" come in Task 2 — at this point the JSON-Schema layer passes for shape correctness.)

- [ ] **Step 6: Commit.**

```bash
git add schemas/list.schema.json tools/test/fixtures/loadout-slots/
git commit -m "feat(schema): add loadout_slots shape to list schema"
```

---

## Task 2: Add semantic validation rules + 7 negative fixtures (TDD)

**Files:**
- Modify: `tools/validate-lists.mjs`
- Create: 7 negative fixtures under `tools/test/fixtures/loadout-slots/`
- Modify: `tools/test/validate-lists.test.js`

- [ ] **Step 1: Write the 7 negative fixtures.**

`tools/test/fixtures/loadout-slots/min-greater-than-max.json`:

```json
{
  "id": "TEST_loadout_min_gt_max", "list_id": "TEST_loadout_min_gt_max",
  "sections": [{"name":"CORE","formations":[{"string_id":"f","id":1,"name":"F","pts":100,"cost_pts":100,"upgrades":[],
    "loadout_slots":[{"string_id":"s","label":"Slot","min":3,"max":2,"variants":[
      {"upgrade_id":100,"is_default":true},{"upgrade_id":101}]}]}]}],
  "upgrades": [{"id":100,"name":"A","pts":0},{"id":101,"name":"B","pts":0}]
}
```

`tools/test/fixtures/loadout-slots/two-defaults.json`:

```json
{
  "id": "TEST_loadout_two_defaults", "list_id": "TEST_loadout_two_defaults",
  "sections": [{"name":"CORE","formations":[{"string_id":"f","id":1,"name":"F","pts":100,"cost_pts":100,"upgrades":[],
    "loadout_slots":[{"string_id":"s","label":"Slot","min":2,"max":2,"variants":[
      {"upgrade_id":100,"is_default":true},{"upgrade_id":101,"is_default":true}]}]}]}],
  "upgrades": [{"id":100,"name":"A","pts":0},{"id":101,"name":"B","pts":0}]
}
```

`tools/test/fixtures/loadout-slots/variant-not-in-upgrades.json`:

```json
{
  "id": "TEST_loadout_missing_upgrade", "list_id": "TEST_loadout_missing_upgrade",
  "sections": [{"name":"CORE","formations":[{"string_id":"f","id":1,"name":"F","pts":100,"cost_pts":100,"upgrades":[],
    "loadout_slots":[{"string_id":"s","label":"Slot","min":2,"max":2,"variants":[
      {"upgrade_id":100,"is_default":true},{"upgrade_id":999}]}]}]}],
  "upgrades": [{"id":100,"name":"A","pts":0}]
}
```

`tools/test/fixtures/loadout-slots/variant-also-in-formation-upgrades.json`:

```json
{
  "id": "TEST_loadout_overlap_formation", "list_id": "TEST_loadout_overlap_formation",
  "sections": [{"name":"CORE","formations":[{"string_id":"f","id":1,"name":"F","pts":100,"cost_pts":100,"upgrades":[100],
    "loadout_slots":[{"string_id":"s","label":"Slot","min":2,"max":2,"variants":[
      {"upgrade_id":100,"is_default":true},{"upgrade_id":101}]}]}]}],
  "upgrades": [{"id":100,"name":"A","pts":0},{"id":101,"name":"B","pts":0}]
}
```

`tools/test/fixtures/loadout-slots/variant-also-in-swap-slot.json` (cross-system check):

```json
{
  "id": "TEST_loadout_overlap_swap", "list_id": "TEST_loadout_overlap_swap",
  "sections": [{"name":"CORE","formations":[{"string_id":"f","id":1,"name":"F","pts":100,"cost_pts":100,"upgrades":[],
    "swap_slots":[{"string_id":"sw","label":"Swap","variants":[
      {"upgrade_id":100,"is_default":true},{"upgrade_id":101}]}],
    "loadout_slots":[{"string_id":"ld","label":"Loadout","min":2,"max":2,"variants":[
      {"upgrade_id":100,"is_default":true},{"upgrade_id":102}]}]}]}],
  "upgrades": [{"id":100,"name":"A","pts":0},{"id":101,"name":"B","pts":0},{"id":102,"name":"C","pts":0}]
}
```

`tools/test/fixtures/loadout-slots/duplicate-string-id-cross-system.json` (cross-system check):

```json
{
  "id": "TEST_loadout_dup_string_id", "list_id": "TEST_loadout_dup_string_id",
  "sections": [{"name":"CORE","formations":[{"string_id":"f","id":1,"name":"F","pts":100,"cost_pts":100,"upgrades":[],
    "swap_slots":[{"string_id":"shared","label":"Swap","variants":[
      {"upgrade_id":100,"is_default":true},{"upgrade_id":101}]}],
    "loadout_slots":[{"string_id":"shared","label":"Loadout","min":2,"max":2,"variants":[
      {"upgrade_id":102,"is_default":true},{"upgrade_id":103}]}]}]}],
  "upgrades": [{"id":100,"name":"A","pts":0},{"id":101,"name":"B","pts":0},
               {"id":102,"name":"C","pts":0},{"id":103,"name":"D","pts":0}]
}
```

`tools/test/fixtures/loadout-slots/empty-variants.json`:

Note — this one must fail at JSON-Schema time (`minItems: 1`), not semantic time. Confirm in the test assertion.

```json
{
  "id": "TEST_loadout_empty_variants", "list_id": "TEST_loadout_empty_variants",
  "sections": [{"name":"CORE","formations":[{"string_id":"f","id":1,"name":"F","pts":100,"cost_pts":100,"upgrades":[],
    "loadout_slots":[{"string_id":"s","label":"Slot","min":0,"max":2,"variants":[]}]}]}],
  "upgrades": []
}
```

- [ ] **Step 2: Add failing tests for each negative fixture.**

Append to `tools/test/validate-lists.test.js`:

```javascript
// --- loadout_slots fixtures ---

test('validator accepts loadout-slots happy fixture', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'happy.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true, `expected ok=true, got: ${JSON.stringify(result.errors)}`);
});

test('validator accepts loadout-slots happy-open fixture (max=3 no default)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'happy-open.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true, `expected ok=true, got: ${JSON.stringify(result.errors)}`);
});

test('validator accepts loadout-slots happy-range fixture (min=2 max=4)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'happy-range.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true);
});

test('rejects loadout slot where min > max', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'min-greater-than-max.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /min.*max|min <= max|min greater/i.test(e)), `got: ${result.errors.join('; ')}`);
});

test('rejects loadout slot with two default variants', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'two-defaults.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /default/i.test(e)));
});

test('rejects loadout variant upgrade_id not in top-level upgrades', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'variant-not-in-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /not found|upgrade.*999/i.test(e)));
});

test('rejects loadout variant also in formation upgrades[]', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'variant-also-in-formation-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /double|both|already/i.test(e)));
});

test('rejects loadout variant overlap with swap_slot variant (cross-system)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'variant-also-in-swap-slot.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /swap_slot|cross-system|both/i.test(e)));
});

test('rejects string_id duplicated across swap_slots and loadout_slots', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'duplicate-string-id-cross-system.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /duplicate|unique/i.test(e)));
});

test('rejects empty loadout variants array (minItems: 1)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'empty-variants.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /minItems|fewer|empty/i.test(e)));
});
```

- [ ] **Step 3: Run the tests to verify they fail.**

Run: `node --test tools/test/validate-lists.test.js`
Expected: 3 positive tests PASS (the schema's loadout_slots block accepts the shapes), 6 semantic-negative tests FAIL (the validator doesn't enforce them yet), 1 empty-variants test PASSES (the JSON-Schema `minItems: 1` already catches this).

So roughly: schema-level checks pass, semantic checks fail. **6 NEW FAILS, 1 already passes via schema, 3 happy passes.** Confirm the count matches before continuing.

- [ ] **Step 4: Implement semantic validation in `tools/validate-lists.mjs`.**

Open `tools/validate-lists.mjs`. Find the existing semantic-check block (added in S3.16 Task 3 — the block that runs after the JSON-schema validation, iterating swap_slots). After the swap_slots block, BEFORE `return errors.length === 0 ? ...`, INSERT the loadout_slots semantic block:

```javascript
  // Semantic checks for loadout_slots (cross-references + cross-system rules).
  for (const section of json.sections ?? []) {
    for (const f of section.formations ?? []) {
      const lslots = f.loadout_slots;
      if (!Array.isArray(lslots) || lslots.length === 0) continue;

      // Build sets of existing swap_slot identifiers on this formation for cross-system checks.
      const swapSlotStringIds = new Set((f.swap_slots ?? []).map((s) => s.string_id).filter(Boolean));
      const swapSlotVariantUpgradeIds = new Set();
      for (const ss of f.swap_slots ?? []) {
        for (const v of ss.variants ?? []) swapSlotVariantUpgradeIds.add(v.upgrade_id);
      }

      const loadoutSlotIds = new Set();
      for (const slot of lslots) {
        // min/max relationship
        if (typeof slot.min === 'number' && typeof slot.max === 'number' && slot.min > slot.max) {
          errors.push(`formation '${f.string_id ?? f.name}' loadout_slot '${slot.string_id}': min (${slot.min}) is greater than max (${slot.max})`);
        }

        // Duplicate string_id within loadout_slots OR across swap_slots
        if (slot.string_id) {
          if (loadoutSlotIds.has(slot.string_id)) {
            errors.push(`formation '${f.string_id ?? f.name}' has duplicate loadout_slot string_id '${slot.string_id}'`);
          }
          if (swapSlotStringIds.has(slot.string_id)) {
            errors.push(`formation '${f.string_id ?? f.name}': string_id '${slot.string_id}' appears in both swap_slots[] and loadout_slots[] (must be unique within a formation)`);
          }
          loadoutSlotIds.add(slot.string_id);
        }

        const variants = slot.variants ?? [];

        // Default count: at most 1
        const defaults = variants.filter((v) => v.is_default === true);
        if (defaults.length > 1) {
          errors.push(`formation '${f.string_id ?? f.name}' loadout_slot '${slot.string_id}': expected at most one variant with is_default:true, found ${defaults.length}`);
        }

        // Each variant must reference a real upgrade
        for (const v of variants) {
          if (!upgradeIds.has(v.upgrade_id)) {
            errors.push(`formation '${f.string_id ?? f.name}' loadout_slot '${slot.string_id}': variant references upgrade_id '${v.upgrade_id}' not found in upgrades[]`);
          }
        }

        // No variant upgrade may also appear in the formation's plain upgrades[]
        const formationUpgrades = new Set(f.upgrades ?? []);
        for (const v of variants) {
          if (formationUpgrades.has(v.upgrade_id)) {
            errors.push(`formation '${f.string_id ?? f.name}': upgrade '${v.upgrade_id}' appears in both loadout_slot '${slot.string_id}' and the formation's upgrades[] (would double-render)`);
          }
        }

        // Cross-system: no variant upgrade may also appear in a sibling swap_slot's variants
        for (const v of variants) {
          if (swapSlotVariantUpgradeIds.has(v.upgrade_id)) {
            errors.push(`formation '${f.string_id ?? f.name}': upgrade '${v.upgrade_id}' appears in both loadout_slot '${slot.string_id}' and a swap_slot variant (cross-system double-render)`);
          }
        }
      }
    }
  }
```

The `upgradeIds` variable is the `Set` already built by the swap-slot block earlier in the function. Place this block AFTER that block but BEFORE the return — so the `upgradeIds` reference is in scope.

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `node --test tools/test/validate-lists.test.js`
Expected: all loadout tests pass (3 happy + 7 negative). Plus all existing swap-slot tests still pass.

- [ ] **Step 6: Re-run CLI against real lists.**

Run: `node tools/validate-lists.mjs`
Expected: still `OK: 156 files`. If a real list now fails, it's a pre-existing issue from the swap_slots backfill that's not in scope here. Stop and report DONE_WITH_CONCERNS with the file/error.

- [ ] **Step 7: Commit.**

```bash
git add tools/validate-lists.mjs tools/test/validate-lists.test.js tools/test/fixtures/loadout-slots/
git commit -m "feat(tools): add semantic checks for loadout_slots in list validator"
```

---

## Task 3: Regenerate auto-generated types

**Files:**
- Modify: `schemas/types.ts` (regenerated)

- [ ] **Step 1: Run the type generator.**

Run: `node tools/generate-types.js`

- [ ] **Step 2: Verify the regenerated file mentions `loadout_slots`.**

Run: `grep -n 'loadout_slots' schemas/types.ts`
Expected: at least one match showing the new optional field on a nested type.

- [ ] **Step 3: Typecheck.**

Run: `npm run typecheck`
Expected: passes — the new type is additive; no consumers reference `loadout_slots` yet at the type level (Task 4 adds the consumers).

- [ ] **Step 4: Commit.**

```bash
git add schemas/types.ts
git commit -m "chore(schema): regenerate types for loadout_slots"
```

---

## Task 4: Selector types + helpers (TDD)

**Files:**
- Modify: `apps/web/src/stores/selectors.ts`
- Modify: `apps/web/src/stores/__tests__/selectors.test.ts`

This task adds the types `CatalogLoadoutSlot` + `CatalogLoadoutVariant`, three pure-function helpers (`getLoadoutPositions`, `loadoutCostForFormation`, `canonicalizeLoadoutChoices`), extends `totalPoints`, and extends `violations`. Plus a minimal `loadout_choices?` field on `BuilderFormation` so the types compile in isolation; full builder-store changes are Task 5.

- [ ] **Step 1: Add failing tests.**

Open `apps/web/src/stores/__tests__/selectors.test.ts`. Replace the existing `sampleCatalog` (which the S3.16 plan already extended with a `demi` formation) with a richer version that adds two new formations: one with a `min=max=2 + default` loadout slot and one with a `max=3 + no default` loadout slot:

Find the existing `sampleCatalog: CatalogList = { … }` block and replace it entirely with:

```typescript
const sampleCatalog: CatalogList = {
  list_id: 'TEST',
  sections: [
    {
      name: 'CORE',
      formations: [
        { string_id: 'inf', name: 'Infantry', cost_pts: 100, upgrades: [1, 2] },
        { string_id: 'tank', name: 'Tank', cost_pts: 250, upgrades: [1] },
        {
          string_id: 'demi',
          name: 'Demi-Century',
          cost_pts: 250,
          upgrades: [1],
          swap_slots: [
            {
              string_id: 'support',
              label: 'Support unit',
              variants: [
                { upgrade_id: 100, is_default: true },
                { upgrade_id: 101 },
              ],
            },
          ],
        },
        {
          string_id: 'warlord',
          name: 'Warlord',
          cost_pts: 725,
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
                { upgrade_id: 52 },
              ],
            },
          ],
        },
        {
          string_id: 'inf_company',
          name: 'Infantry Company',
          cost_pts: 200,
          upgrades: [],
          loadout_slots: [
            {
              string_id: 'support_upg',
              label: 'Support upgrades',
              max: 3,
              variants: [
                { upgrade_id: 100 },
                { upgrade_id: 101 },
                { upgrade_id: 102 },
              ],
            },
          ],
        },
      ],
    },
  ],
  upgrades: [
    { id: 1, string_id: 'commander', name: 'Commander', cost_pts: 50 },
    { id: 2, string_id: 'banner', name: 'Banner', cost_pts: 25 },
    { id: 50, string_id: 'macro_gatling', name: 'Macro Gatling Blaster', cost_pts: 0 },
    { id: 51, string_id: 'sunfury_plasma', name: 'Sunfury Plasma', cost_pts: 50 },
    { id: 52, string_id: 'power_claw', name: 'Power Claw', cost_pts: 25 },
    { id: 100, string_id: 'gun_servitors', name: 'Gun Servitors', cost_pts: 0 },
    { id: 101, string_id: 'rapier_lasers', name: 'Rapier Lasers', cost_pts: 30 },
    { id: 102, string_id: 'manticore', name: 'Manticore', cost_pts: 100 },
  ],
};
```

Then APPEND the loadout-slot test blocks at the end of the file (after the swap_slot describe blocks added in S3.16):

```typescript
import {
  getLoadoutPositions,
  loadoutCostForFormation,
  canonicalizeLoadoutChoices,
  type CatalogLoadoutSlot,
} from '../selectors';

describe('loadout_slots — getLoadoutPositions', () => {
  test('returns N copies of default when min=max=N + default exists + no saved state', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, undefined, 'weapons');
    assert.deepStrictEqual(positions, ['macro_gatling', 'macro_gatling']);
  });

  test('returns empty array when no default + max only', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf_company')!;
    const positions = getLoadoutPositions(sampleCatalog, def, undefined, 'support_upg');
    assert.deepStrictEqual(positions, []);
  });

  test('returns saved positions when valid', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, { weapons: ['sunfury_plasma', 'power_claw'] }, 'weapons');
    assert.deepStrictEqual(positions, ['sunfury_plasma', 'power_claw']);
  });

  test('replaces stale variant with default (catalog drift)', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, { weapons: ['ghost_variant', 'sunfury_plasma'] }, 'weapons');
    assert.deepStrictEqual(positions, ['macro_gatling', 'sunfury_plasma']);
  });

  test('drops stale position when no default available', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf_company')!;
    const positions = getLoadoutPositions(sampleCatalog, def, { support_upg: ['ghost'] }, 'support_upg');
    assert.deepStrictEqual(positions, []);
  });

  test('returns null when slot does not exist', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    const positions = getLoadoutPositions(sampleCatalog, def, undefined, 'unknown_slot');
    assert.strictEqual(positions, null);
  });
});

describe('loadout_slots — loadoutCostForFormation', () => {
  test('returns 0 when all positions are defaults', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, undefined), 0);
  });

  test('returns delta sum when default exists and positions differ', () => {
    const def = findFormationByStringId(sampleCatalog, 'warlord')!;
    // default macro_gatling=0, chosen sunfury_plasma=50, power_claw=25
    // delta = (50-0) + (25-0) = 75
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, { weapons: ['sunfury_plasma', 'power_claw'] }), 75);
  });

  test('returns absolute sum when no default', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf_company')!;
    // hydra=50, manticore=100 → 150
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, { support_upg: ['gun_servitors', 'manticore'] }), 150);
  });

  test('returns 0 for formations with no loadout_slots', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf')!;
    assert.strictEqual(loadoutCostForFormation(sampleCatalog, def, undefined), 0);
  });
});

describe('loadout_slots — totalPoints integration', () => {
  test('warlord formation with all default positions costs base only', () => {
    const state = emptyState();
    state.formations = [{ instance_id: 'w1', formation_string_id: 'warlord', upgrade_string_ids: [] }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 725);
  });

  test('warlord formation with one non-default position adds the delta', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['sunfury_plasma', 'macro_gatling'] },
    }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 775);
  });

  test('inf_company with two added support upgrades adds their absolute pts', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'c1',
      formation_string_id: 'inf_company',
      upgrade_string_ids: [],
      loadout_choices: { support_upg: ['gun_servitors', 'manticore'] },
    }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 350);
  });
});

describe('loadout_slots — canonicalizeLoadoutChoices', () => {
  test('strips slot whose positions equal [default x min]', () => {
    const inst = {
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['macro_gatling', 'macro_gatling'] },
    };
    const out = canonicalizeLoadoutChoices(sampleCatalog, inst);
    assert.strictEqual(out.loadout_choices, undefined);
  });

  test('strips slot with empty positions when no default + max only', () => {
    const inst = {
      instance_id: 'c1',
      formation_string_id: 'inf_company',
      upgrade_string_ids: [],
      loadout_choices: { support_upg: [] },
    };
    const out = canonicalizeLoadoutChoices(sampleCatalog, inst);
    assert.strictEqual(out.loadout_choices, undefined);
  });

  test('keeps slot when positions diverge from canonical state', () => {
    const inst = {
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['sunfury_plasma', 'macro_gatling'] },
    };
    const out = canonicalizeLoadoutChoices(sampleCatalog, inst);
    assert.deepStrictEqual(out.loadout_choices, { weapons: ['sunfury_plasma', 'macro_gatling'] });
  });
});

describe('loadout_slots — violations', () => {
  test('flags when current position count < min', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'w1',
      formation_string_id: 'warlord',
      upgrade_string_ids: [],
      loadout_choices: { weapons: ['sunfury_plasma'] }, // only 1 position, min=2
    }];
    const msgs = violations(state, sampleCatalog);
    assert.ok(msgs.some((m) => /Warlord.*Weapons.*at least 2/i.test(m)), `got: ${msgs.join('; ')}`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npm test --workspace apps/web`
Expected: existing 20 tests still pass (from S3.16 + #38). New loadout tests FAIL with TypeScript errors about missing exports (`getLoadoutPositions`, `loadoutCostForFormation`, `canonicalizeLoadoutChoices`, `CatalogLoadoutSlot`) and missing fields on `BuilderFormation` (`loadout_choices`) and `CatalogFormation` (`loadout_slots`).

- [ ] **Step 3: Extend `apps/web/src/stores/selectors.ts` with the new types and helpers.**

Open `apps/web/src/stores/selectors.ts`. Add the new types and helpers — preserving everything existing:

After the existing `CatalogSwapVariant` interface declaration, ADD:

```typescript
export interface CatalogLoadoutSlot {
  string_id: string;
  label: string;
  min?: number;
  max?: number;
  variants: CatalogLoadoutVariant[];
}

export interface CatalogLoadoutVariant {
  upgrade_id: number | string;
  is_default?: boolean;
}
```

Find the existing `CatalogFormation` interface and add the optional `loadout_slots` field right after `swap_slots`:

```typescript
export interface CatalogFormation {
  id?: number;
  string_id?: string;
  name: string;
  pts?: number;
  cost_pts?: number;
  units?: string;
  upgrades?: number[];
  swap_slots?: CatalogSwapSlot[];
  loadout_slots?: CatalogLoadoutSlot[];   // NEW
}
```

After the existing `swapDeltaForFormation` function, APPEND the new helpers:

```typescript
/**
 * The default variant's upgrade.string_id for a given loadout slot. Returns null when no default exists.
 */
function loadoutDefaultStringId(catalog: CatalogList, slot: CatalogLoadoutSlot): string | null {
  const def = slot.variants.find((v) => v.is_default === true);
  if (!def) return null;
  const up = findUpgradeById(catalog, def.upgrade_id);
  return up?.string_id ?? null;
}

/**
 * Resolves the array of variant string_ids currently in the slot's positions.
 *
 * - If the saved choices contain a valid array for this slot, returns that array, replacing
 *   stale variants with the default (or dropping the position when no default is available).
 * - Otherwise returns the canonical initial state:
 *   - `[default × min]` when default exists and min is set (min >= 1)
 *   - `[]` otherwise
 *
 * Returns `null` when the slot itself doesn't exist on the formation.
 */
export function getLoadoutPositions(
  catalog: CatalogList,
  formation: CatalogFormation,
  loadout_choices: Record<string, string[]> | undefined,
  slot_string_id: string,
): string[] | null {
  const slot = formation.loadout_slots?.find((s) => s.string_id === slot_string_id);
  if (!slot) return null;
  const defaultStringId = loadoutDefaultStringId(catalog, slot);
  const saved = loadout_choices?.[slot_string_id];

  if (Array.isArray(saved)) {
    const validVariantStringIds = new Set(
      slot.variants
        .map((v) => findUpgradeById(catalog, v.upgrade_id)?.string_id)
        .filter((s): s is string => !!s),
    );
    const out: string[] = [];
    for (const p of saved) {
      if (validVariantStringIds.has(p)) {
        out.push(p);
      } else if (defaultStringId) {
        out.push(defaultStringId);
      }
      // else: drop the position
    }
    return out;
  }

  // No saved state — return canonical initial state.
  if (defaultStringId && typeof slot.min === 'number' && slot.min >= 1) {
    return Array(slot.min).fill(defaultStringId);
  }
  return [];
}

/**
 * Total pts contribution from a formation's loadout slots.
 *
 * - When a slot has a default: cost = Σ (chosen.pts − default.pts) across positions (delta semantics).
 * - When a slot has no default: cost = Σ chosen.pts across positions (absolute; formation.cost_pts
 *   does not include any baseline loadout cost for these slots).
 */
export function loadoutCostForFormation(
  catalog: CatalogList,
  formation: CatalogFormation,
  loadout_choices: Record<string, string[]> | undefined,
): number {
  let total = 0;
  for (const slot of formation.loadout_slots ?? []) {
    const positions = getLoadoutPositions(catalog, formation, loadout_choices, slot.string_id);
    if (!positions) continue;
    const defaultVar = slot.variants.find((v) => v.is_default === true);
    const defaultUp = defaultVar ? findUpgradeById(catalog, defaultVar.upgrade_id) : null;
    const defaultPts = defaultUp ? (defaultUp.cost_pts ?? defaultUp.pts ?? 0) : 0;
    for (const p of positions) {
      const up = findUpgradeByStringId(catalog, p);
      const pts = up ? (up.cost_pts ?? up.pts ?? 0) : 0;
      total += defaultUp ? pts - defaultPts : pts;
    }
  }
  return total;
}

/**
 * Returns a new BuilderFormation with `loadout_choices` stripped to canonical form:
 * slots whose positions equal the canonical initial state are dropped from the map.
 * If the resulting map is empty, `loadout_choices` is omitted entirely.
 *
 * Used at save-time to keep persisted bodies small.
 */
export function canonicalizeLoadoutChoices(
  catalog: CatalogList,
  instance: { formation_string_id: string; loadout_choices?: Record<string, string[]>; [k: string]: unknown },
): typeof instance {
  const def = findFormationByStringId(catalog, instance.formation_string_id);
  if (!def || !instance.loadout_choices) return instance;
  const canonical: Record<string, string[]> = {};
  for (const [slotKey, positions] of Object.entries(instance.loadout_choices)) {
    const slot = def.loadout_slots?.find((s) => s.string_id === slotKey);
    if (!slot) continue; // drop stale slots silently
    const defaultStringId = loadoutDefaultStringId(catalog, slot);
    const initialState: string[] =
      defaultStringId && typeof slot.min === 'number' && slot.min >= 1
        ? Array(slot.min).fill(defaultStringId)
        : [];
    if (positions.length === initialState.length && positions.every((p, i) => p === initialState[i])) {
      continue; // canonical, drop
    }
    canonical[slotKey] = positions;
  }
  const next = { ...instance };
  if (Object.keys(canonical).length === 0) {
    delete next.loadout_choices;
  } else {
    next.loadout_choices = canonical;
  }
  return next;
}
```

Update `totalPoints` — find the existing function and add the loadout cost to the running total:

```typescript
export function totalPoints(state: BuilderState, catalog: CatalogList): number {
  let total = 0;
  for (const inst of state.formations) {
    const def = findFormationByStringId(catalog, inst.formation_string_id);
    if (!def) continue;
    total += def.cost_pts ?? def.pts ?? 0;
    for (const upgradeStringId of inst.upgrade_string_ids) {
      const u = findUpgradeByStringId(catalog, upgradeStringId);
      if (u) total += u.cost_pts ?? u.pts ?? 0;
    }
    total += swapDeltaForFormation(catalog, def, inst.swap_choices);
    total += loadoutCostForFormation(catalog, def, inst.loadout_choices);  // NEW
  }
  return total;
}
```

Update `violations` — extend the function to add the "min not satisfied" message for loadout slots:

```typescript
export function violations(state: BuilderState, catalog: CatalogList): string[] {
  const msgs: string[] = [];
  if (state.points_target != null) {
    const total = totalPoints(state, catalog);
    if (total > state.points_target) {
      msgs.push(`Over points target by ${total - state.points_target}.`);
    }
  }
  // NEW: loadout slot min violations
  for (const inst of state.formations) {
    const def = findFormationByStringId(catalog, inst.formation_string_id);
    if (!def) continue;
    for (const slot of def.loadout_slots ?? []) {
      if (typeof slot.min !== 'number' || slot.min === 0) continue;
      const positions = getLoadoutPositions(catalog, def, inst.loadout_choices, slot.string_id);
      if (!positions) continue;
      if (positions.length < slot.min) {
        const noun = slot.min === 1 ? 'selection' : 'selections';
        msgs.push(`${def.name}: '${slot.label}' requires at least ${slot.min} ${noun} (currently ${positions.length}).`);
      }
    }
  }
  return msgs;
}
```

- [ ] **Step 4: Add the minimal `loadout_choices` field on BuilderFormation.**

Open `apps/web/src/stores/builder-store.ts`. Find the `BuilderFormation` interface and add ONE new optional field after `swap_choices`:

```typescript
export interface BuilderFormation {
  instance_id: string;
  formation_string_id: string;
  upgrade_string_ids: string[];
  swap_choices?: Record<string, string>;
  /** Map from loadout_slot.string_id to the array of chosen variant upgrade.string_ids,
   * one entry per filled position. Absent when canonical initial state applies. */
  loadout_choices?: Record<string, string[]>;  // NEW
}
```

Do NOT touch any of the actions, `body_version`, or the `create()` body yet — Task 5 expands the store.

- [ ] **Step 5: Run tests to verify they pass.**

Run: `npm test --workspace apps/web`
Expected: all 20 existing tests still pass; all new loadout selector tests pass. Total ~33 tests.

- [ ] **Step 6: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/src/stores/selectors.ts apps/web/src/stores/__tests__/selectors.test.ts apps/web/src/stores/builder-store.ts
git commit -m "feat(web): selector helpers for loadout_slots positions + cost + canonicalization"
```

---

## Task 5: Builder store — actions + body_version bump (TDD)

**Files:**
- Modify: `apps/web/src/stores/builder-store.ts`
- Modify: `apps/web/src/stores/__tests__/selectors.test.ts`

- [ ] **Step 1: Add failing tests for the new store actions.**

Append to `apps/web/src/stores/__tests__/selectors.test.ts`:

```typescript
describe('builder-store — loadout actions', () => {
  test('setLoadoutPosition replaces variant at the given index', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('warlord');
    const inst = useBuilderStore.getState().formations[0];
    // Initially loadout_choices undefined; calling setLoadoutPosition should initialize it
    useBuilderStore.getState().setLoadoutPosition(inst.instance_id, 'weapons', 0, 'sunfury_plasma');
    const after = useBuilderStore.getState().formations[0];
    assert.deepStrictEqual(after.loadout_choices, { weapons: ['sunfury_plasma'] });
  });

  test('setLoadoutPosition at index past current length pads sparse positions', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('warlord');
    const inst = useBuilderStore.getState().formations[0];
    useBuilderStore.getState().setLoadoutPosition(inst.instance_id, 'weapons', 2, 'sunfury_plasma');
    const after = useBuilderStore.getState().formations[0];
    // Length grows to index+1; intermediate slots are empty strings (resolved by getLoadoutPositions)
    assert.strictEqual(after.loadout_choices?.weapons.length, 3);
    assert.strictEqual(after.loadout_choices?.weapons[2], 'sunfury_plasma');
  });

  test('appendLoadoutPosition pushes a new variant to the end', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('inf_company');
    const inst = useBuilderStore.getState().formations[0];
    useBuilderStore.getState().appendLoadoutPosition(inst.instance_id, 'support_upg', 'gun_servitors');
    useBuilderStore.getState().appendLoadoutPosition(inst.instance_id, 'support_upg', 'manticore');
    const after = useBuilderStore.getState().formations[0];
    assert.deepStrictEqual(after.loadout_choices?.support_upg, ['gun_servitors', 'manticore']);
  });

  test('removeLoadoutPosition removes the position at the given index', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('warlord');
    const inst = useBuilderStore.getState().formations[0];
    useBuilderStore.getState().setLoadoutPosition(inst.instance_id, 'weapons', 0, 'sunfury_plasma');
    useBuilderStore.getState().setLoadoutPosition(inst.instance_id, 'weapons', 1, 'power_claw');
    useBuilderStore.getState().removeLoadoutPosition(inst.instance_id, 'weapons', 0);
    const after = useBuilderStore.getState().formations[0];
    assert.deepStrictEqual(after.loadout_choices?.weapons, ['power_claw']);
  });

  test('removeLoadoutPosition that leaves the slot empty also clears the loadout_choices entry', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('inf_company');
    const inst = useBuilderStore.getState().formations[0];
    useBuilderStore.getState().appendLoadoutPosition(inst.instance_id, 'support_upg', 'gun_servitors');
    useBuilderStore.getState().removeLoadoutPosition(inst.instance_id, 'support_upg', 0);
    const after = useBuilderStore.getState().formations[0];
    assert.strictEqual(after.loadout_choices, undefined);
  });
});

describe('builder-store — body_version v3', () => {
  test('initFromCatalog sets body_version to 3', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    assert.strictEqual(useBuilderStore.getState().body_version, 3);
  });

  test('reset returns body_version to 3', () => {
    useBuilderStore.getState().reset();
    assert.strictEqual(useBuilderStore.getState().body_version, 3);
  });

  test('initFromSavedList reads body.body_version (3) from saved bodies', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromSavedList({
      id: 's1', list_id: 'TEST', title: 't', points_target: null, is_public: false,
      body: { body_version: 3, formations: [] },
    });
    assert.strictEqual(useBuilderStore.getState().body_version, 3);
  });

  test('initFromSavedList preserves legacy v2 body_version', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromSavedList({
      id: 's1', list_id: 'TEST', title: 't', points_target: null, is_public: false,
      body: { body_version: 2, formations: [] },
    });
    assert.strictEqual(useBuilderStore.getState().body_version, 2);
  });

  test('initFromSavedList defaults missing body_version to 1', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromSavedList({
      id: 's1', list_id: 'TEST', title: 't', points_target: null, is_public: false,
      body: { formations: [] },
    });
    assert.strictEqual(useBuilderStore.getState().body_version, 1);
  });
});
```

Also: update the `emptyState()` helper at the top of the file to include the three new stub actions so the type matches the expanded `BuilderState` interface — find the existing `emptyState()` function and add inside the returned object (alongside the existing stub `selectSwapVariant: () => {}`):

```typescript
    setLoadoutPosition: () => {},
    appendLoadoutPosition: () => {},
    removeLoadoutPosition: () => {},
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npm test --workspace apps/web`
Expected: existing tests still pass; new loadout-action tests FAIL (`setLoadoutPosition is not a function`); body_version tests showing `2` instead of `3` (initFromCatalog and reset still use `body_version: 2` from S3.16's Task 7).

- [ ] **Step 3: Update `apps/web/src/stores/builder-store.ts`.**

Find the `BuilderState` interface and add the three new action signatures after `selectSwapVariant`:

```typescript
  selectSwapVariant(
    instance_id: string,
    slot_string_id: string,
    chosen_variant_string_id: string,
    default_variant_string_id: string,
  ): void;
  /** Set the variant at a specific position index in a loadout slot. If `position_index`
   * exceeds the current length, the array grows; intermediate sparse slots become empty
   * strings (resolved to default/empty by getLoadoutPositions at render time). */
  setLoadoutPosition(
    instance_id: string,
    slot_string_id: string,
    position_index: number,
    variant_string_id: string,
  ): void;
  /** Append a new position with the given variant to the loadout slot. */
  appendLoadoutPosition(
    instance_id: string,
    slot_string_id: string,
    variant_string_id: string,
  ): void;
  /** Remove the position at the given index. If the slot's positions become empty,
   * the slot entry is removed from loadout_choices. */
  removeLoadoutPosition(
    instance_id: string,
    slot_string_id: string,
    position_index: number,
  ): void;
```

Update `initFromCatalog` to set `body_version: 3`:

```typescript
  initFromCatalog: (list_id) => set({
    list_id,
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 3,  // was 2
    formations: [],
  }),
```

Update `reset` similarly:

```typescript
  reset: () => set({
    list_id: null,
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 3,  // was 2
    formations: [],
  }),
```

The existing `initFromSavedList` already reads `body.body_version` and defaults to 1 — no change needed there.

Update the JSDoc on `body_version`:

```typescript
  /** Body schema version. Absent/1 = legacy; 2 = with swap_choices (S3.16);
   * 3 = with loadout_choices (this spec). Always written as 3 going forward. */
  body_version: number;
```

Add the three new action implementations in the `create<BuilderState>()` body, after `selectSwapVariant`:

```typescript
  setLoadoutPosition: (instance_id, slot_string_id, position_index, variant_string_id) => set((s) => ({
    formations: s.formations.map((f) => {
      if (f.instance_id !== instance_id) return f;
      const current = { ...(f.loadout_choices ?? {}) };
      const positions = [...(current[slot_string_id] ?? [])];
      // Grow with empty strings to reach position_index
      while (positions.length <= position_index) positions.push('');
      positions[position_index] = variant_string_id;
      current[slot_string_id] = positions;
      const next: BuilderFormation = { ...f, loadout_choices: current };
      return next;
    }),
  })),
  appendLoadoutPosition: (instance_id, slot_string_id, variant_string_id) => set((s) => ({
    formations: s.formations.map((f) => {
      if (f.instance_id !== instance_id) return f;
      const current = { ...(f.loadout_choices ?? {}) };
      const positions = [...(current[slot_string_id] ?? []), variant_string_id];
      current[slot_string_id] = positions;
      const next: BuilderFormation = { ...f, loadout_choices: current };
      return next;
    }),
  })),
  removeLoadoutPosition: (instance_id, slot_string_id, position_index) => set((s) => ({
    formations: s.formations.map((f) => {
      if (f.instance_id !== instance_id) return f;
      const current = { ...(f.loadout_choices ?? {}) };
      const positions = [...(current[slot_string_id] ?? [])];
      positions.splice(position_index, 1);
      const next: BuilderFormation = { ...f };
      if (positions.length === 0) {
        delete current[slot_string_id];
      } else {
        current[slot_string_id] = positions;
      }
      if (Object.keys(current).length === 0) {
        delete next.loadout_choices;
      } else {
        next.loadout_choices = current;
      }
      return next;
    }),
  })),
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npm test --workspace apps/web`
Expected: all tests pass, including the new ~10 store action + body_version tests.

- [ ] **Step 5: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/stores/builder-store.ts apps/web/src/stores/__tests__/selectors.test.ts
git commit -m "feat(web): loadout_choices actions in builder store with body_version=3"
```

---

## Task 6: Install shadcn Popover + create LoadoutSlotControl component

**Files:**
- Modify: `apps/web/package.json` (add `@radix-ui/react-popover`)
- Create: `apps/web/src/components/ui/popover.tsx`
- Create: `apps/web/src/components/LoadoutSlotControl.tsx`

- [ ] **Step 1: Install Radix Popover.**

Run: `npm install --save @radix-ui/react-popover --workspace apps/web`

Expected: package.json + package-lock.json updated.

- [ ] **Step 2: Create the shadcn-style Popover primitive at `apps/web/src/components/ui/popover.tsx`.**

```tsx
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={[
        'z-50 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className ?? '',
      ].join(' ')}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
```

- [ ] **Step 3: Create `apps/web/src/components/LoadoutSlotControl.tsx`.**

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  findUpgradeById,
  findUpgradeByStringId,
  getLoadoutPositions,
  type CatalogList,
  type CatalogFormation,
  type CatalogLoadoutSlot,
} from '@/stores/selectors';
import { useBuilderStore } from '@/stores/builder-store';

type Props = {
  slot: CatalogLoadoutSlot;
  catalog: CatalogList;
  formation: CatalogFormation;
  instanceId: string;
  loadoutChoices: Record<string, string[]> | undefined;
};

function variantDeltaLabel(catalog: CatalogList, slot: CatalogLoadoutSlot, chosenStringId: string): string {
  const defaultVariant = slot.variants.find((v) => v.is_default === true);
  const chosenUp = findUpgradeByStringId(catalog, chosenStringId);
  const chosenPts = chosenUp?.cost_pts ?? chosenUp?.pts ?? 0;
  if (defaultVariant) {
    const defaultUp = findUpgradeById(catalog, defaultVariant.upgrade_id);
    const defaultPts = defaultUp?.cost_pts ?? defaultUp?.pts ?? 0;
    const delta = chosenPts - defaultPts;
    return delta === 0 ? '(+0)' : delta > 0 ? `(+${delta})` : `(${delta})`;
  }
  return `(${chosenPts})`;
}

export function LoadoutSlotControl({ slot, catalog, formation, instanceId, loadoutChoices }: Props) {
  const builder = useBuilderStore();
  const positions = getLoadoutPositions(catalog, formation, loadoutChoices, slot.string_id) ?? [];
  const min = slot.min ?? 0;
  const max = slot.max ?? Infinity;
  const isUnderMin = positions.length < min;
  const canAdd = positions.length < max;

  return (
    <li className={`text-sm ${isUnderMin ? 'rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1' : ''}`}>
      <span className="text-xs uppercase text-muted-foreground">{slot.label}:</span>
      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
        {positions.map((pos, idx) => (
          <LoadoutChip
            key={`${slot.string_id}-${idx}`}
            slot={slot}
            catalog={catalog}
            instanceId={instanceId}
            position={pos}
            positionIndex={idx}
            isRemovable={positions.length > min}
          />
        ))}
        {canAdd && (
          <AddLoadoutChip slot={slot} catalog={catalog} instanceId={instanceId} />
        )}
      </span>
    </li>
  );
}

function LoadoutChip({
  slot,
  catalog,
  instanceId,
  position,
  positionIndex,
  isRemovable,
}: {
  slot: CatalogLoadoutSlot;
  catalog: CatalogList;
  instanceId: string;
  position: string;
  positionIndex: number;
  isRemovable: boolean;
}) {
  const builder = useBuilderStore();
  const [open, setOpen] = useState(false);
  const currentUp = position ? findUpgradeByStringId(catalog, position) : null;
  const display = currentUp?.name ?? '(empty)';
  const cost = position ? variantDeltaLabel(catalog, slot, position) : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Position ${positionIndex + 1} of ${slot.label}: ${display}`}
          className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted print:hidden"
        >
          <span>{display} {cost}</span>
          <span aria-hidden>▾</span>
          {isRemovable && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Remove position ${positionIndex + 1} from ${slot.label}`}
              onClick={(e) => { e.stopPropagation(); builder.removeLoadoutPosition(instanceId, slot.string_id, positionIndex); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault(); e.stopPropagation();
                  builder.removeLoadoutPosition(instanceId, slot.string_id, positionIndex);
                }
              }}
              className="ml-1 cursor-pointer text-muted-foreground hover:text-destructive"
            >
              ×
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <ul className="space-y-0.5 text-xs">
          {slot.variants.map((v) => {
            const up = findUpgradeById(catalog, v.upgrade_id);
            if (!up?.string_id) return null;
            const checked = up.string_id === position;
            const label = variantDeltaLabel(catalog, slot, up.string_id);
            return (
              <li key={String(v.upgrade_id)}>
                <button
                  type="button"
                  onClick={() => {
                    builder.setLoadoutPosition(instanceId, slot.string_id, positionIndex, up.string_id!);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted ${checked ? 'bg-muted font-medium' : ''}`}
                >
                  <span>{up.name}</span>
                  <span className="text-muted-foreground">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function AddLoadoutChip({
  slot,
  catalog,
  instanceId,
}: {
  slot: CatalogLoadoutSlot;
  catalog: CatalogList;
  instanceId: string;
}) {
  const builder = useBuilderStore();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Add ${slot.label} position`}
          className="inline-flex items-center gap-1 rounded-md border border-dashed bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted print:hidden"
        >
          <span>+ Add</span>
          <span aria-hidden>▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <ul className="space-y-0.5 text-xs">
          {slot.variants.map((v) => {
            const up = findUpgradeById(catalog, v.upgrade_id);
            if (!up?.string_id) return null;
            const label = variantDeltaLabel(catalog, slot, up.string_id);
            return (
              <li key={String(v.upgrade_id)}>
                <button
                  type="button"
                  onClick={() => {
                    builder.appendLoadoutPosition(instanceId, slot.string_id, up.string_id!);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted"
                >
                  <span>{up.name}</span>
                  <span className="text-muted-foreground">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 5: Run web tests.**

Run: `npm test --workspace apps/web`
Expected: all 30+ existing tests still pass. (No new tests for the component itself — covered by the manual smoke test in Task 12.)

- [ ] **Step 6: Build to confirm vite + tsc are happy.**

Run: `npm run build --workspace apps/web 2>&1 | tail -5`
Expected: build succeeds with no errors.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/components/ui/popover.tsx apps/web/src/components/LoadoutSlotControl.tsx
git commit -m "feat(web): add LoadoutSlotControl chip+popover component"
```

---

## Task 7: Wire LoadoutSlotControl into FormationCard + canonicalize on save

**Files:**
- Modify: `apps/web/src/routes/build.$listId.tsx`

- [ ] **Step 1: Update imports.**

Find the existing imports block in `apps/web/src/routes/build.$listId.tsx`. Replace this import:

```typescript
import {
  totalPoints,
  violations,
  findUpgradeByStringId,
  findUpgradeById,
  getSwapChoice,
  swapDeltaForFormation,
  type CatalogList,
  type CatalogSwapSlot,
} from '@/stores/selectors';
```

with:

```typescript
import {
  totalPoints,
  violations,
  findUpgradeByStringId,
  findUpgradeById,
  getSwapChoice,
  swapDeltaForFormation,
  getLoadoutPositions,
  loadoutCostForFormation,
  canonicalizeLoadoutChoices,
  type CatalogList,
  type CatalogSwapSlot,
} from '@/stores/selectors';
```

And add the new component import:

```typescript
import { LoadoutSlotControl } from '@/components/LoadoutSlotControl';
```

- [ ] **Step 2: Update the instance prop type on `FormationCard` to include `loadout_choices`.**

Find the inline prop type for `FormationCard`'s `instance`:

```typescript
  instance: { instance_id: string; formation_string_id: string; upgrade_string_ids: string[]; swap_choices?: Record<string, string> };
```

Replace with:

```typescript
  instance: {
    instance_id: string;
    formation_string_id: string;
    upgrade_string_ids: string[];
    swap_choices?: Record<string, string>;
    loadout_choices?: Record<string, string[]>;
  };
```

- [ ] **Step 3: Add loadout cost to `totalCost` in `FormationCard`.**

Find the existing line `totalCost += swapDeltaForFormation(catalog, def, instance.swap_choices);` and add the loadout cost right after:

```typescript
  totalCost += swapDeltaForFormation(catalog, def, instance.swap_choices);
  totalCost += loadoutCostForFormation(catalog, def, instance.loadout_choices);  // NEW
```

- [ ] **Step 4: Render `<LoadoutSlotControl />` rows in the Composition section.**

Find the existing Composition block:

```tsx
      {(def.swap_slots ?? []).length > 0 && (
        <div className="mt-3 border-t pt-2 print:hidden">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Composition</p>
          <ul className="space-y-2">
            {(def.swap_slots ?? []).map((slot) => (
              <SwapSlotControl … />
            ))}
          </ul>
        </div>
      )}
```

Replace it with a version that handles both swap_slots and loadout_slots and shows the Composition block when either is non-empty:

```tsx
      {((def.swap_slots ?? []).length > 0 || (def.loadout_slots ?? []).length > 0) && (
        <div className="mt-3 border-t pt-2 print:hidden">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Composition</p>
          <ul className="space-y-2">
            {(def.swap_slots ?? []).map((slot) => (
              <SwapSlotControl
                key={slot.string_id}
                slot={slot}
                catalog={catalog}
                instanceId={instance.instance_id}
                currentChoiceStringId={getSwapChoice(catalog, def, instance.swap_choices, slot.string_id)}
              />
            ))}
            {(def.loadout_slots ?? []).map((slot) => (
              <LoadoutSlotControl
                key={slot.string_id}
                slot={slot}
                catalog={catalog}
                formation={def}
                instanceId={instance.instance_id}
                loadoutChoices={instance.loadout_choices}
              />
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 5: Add loadout choices to the print view.**

Find the existing print block:

```tsx
      {(selectedUpgrades.length > 0 || (def.swap_slots ?? []).length > 0) && (
        <ul className="mt-2 hidden space-y-1 print:block">
          {(def.swap_slots ?? []).map((slot) => { … })}
          {selectedUpgrades.map((u) => ( … ))}
        </ul>
      )}
```

Replace with:

```tsx
      {(selectedUpgrades.length > 0 || (def.swap_slots ?? []).length > 0 || (def.loadout_slots ?? []).length > 0) && (
        <ul className="mt-2 hidden space-y-1 print:block">
          {(def.swap_slots ?? []).map((slot) => {
            const chosenSid = getSwapChoice(catalog, def, instance.swap_choices, slot.string_id);
            const chosen = chosenSid ? findUpgradeByStringId(catalog, chosenSid) : null;
            return chosen ? (
              <li key={slot.string_id} className="text-sm">
                • {slot.label}: {chosen.name}
              </li>
            ) : null;
          })}
          {(def.loadout_slots ?? []).map((slot) => {
            const positions = getLoadoutPositions(catalog, def, instance.loadout_choices, slot.string_id) ?? [];
            if (positions.length === 0) return null;
            // Collapse consecutive same variants into "Nx Name"; otherwise comma-separate
            const counts = new Map<string, number>();
            for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1);
            const items: string[] = [];
            for (const [stringId, n] of counts) {
              const up = findUpgradeByStringId(catalog, stringId);
              if (!up) continue;
              items.push(n === 1 ? up.name : `${n}x ${up.name}`);
            }
            return (
              <li key={slot.string_id} className="text-sm">
                • {slot.label}: {items.join(', ')}
              </li>
            );
          })}
          {selectedUpgrades.map((u) => (
            <li key={u.id} className="text-sm">
              • {u.name}
              {(u.cost_pts ?? u.pts ?? 0) > 0 && (
                <span className="ml-1 text-xs">(+{u.cost_pts ?? u.pts ?? 0})</span>
              )}
            </li>
          ))}
        </ul>
      )}
```

- [ ] **Step 6: Update `handleSave` to call `canonicalizeLoadoutChoices`.**

Find the existing `handleSave` function:

```typescript
  function handleSave() {
    if (!isSignedIn) return;
    saveMutation.mutate({
      id: builder.user_list_id ?? undefined,
      title: builder.title.trim() || 'Untitled list',
      list_id: catalog.list_id,
      points_target: builder.points_target ?? undefined,
      body: { body_version: builder.body_version as 1 | 2, formations: builder.formations },
      is_public: builder.is_public,
    });
  }
```

Replace with:

```typescript
  function handleSave() {
    if (!isSignedIn) return;
    const canonical = builder.formations.map((f) => canonicalizeLoadoutChoices(catalog, f));
    saveMutation.mutate({
      id: builder.user_list_id ?? undefined,
      title: builder.title.trim() || 'Untitled list',
      list_id: catalog.list_id,
      points_target: builder.points_target ?? undefined,
      body: { body_version: builder.body_version as 1 | 2 | 3, formations: canonical },
      is_public: builder.is_public,
    });
  }
```

- [ ] **Step 7: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 8: Run web tests.**

Run: `npm test --workspace apps/web`
Expected: all tests pass.

- [ ] **Step 9: Build.**

Run: `npm run build --workspace apps/web 2>&1 | tail -5`
Expected: green.

- [ ] **Step 10: Commit.**

```bash
git add apps/web/src/routes/build.\$listId.tsx
git commit -m "feat(web): render loadout_slots in builder Composition + canonicalize on save"
```

---

## Task 8: Update shared viewer to render loadout positions

**Files:**
- Modify: `apps/web/src/routes/list.$id.tsx`

- [ ] **Step 1: Update imports.**

Find the existing selector imports at the top of `apps/web/src/routes/list.$id.tsx`. Add `getLoadoutPositions`, `loadoutCostForFormation`, and `type CatalogLoadoutSlot` if not already present:

```typescript
import {
  totalPoints,
  violations,
  findUpgradeByStringId,
  findUpgradeById,
  getSwapChoice,
  swapDeltaForFormation,
  getLoadoutPositions,
  loadoutCostForFormation,
  type CatalogList,
  type CatalogSwapSlot,
  type CatalogLoadoutSlot,
} from '@/stores/selectors';
```

- [ ] **Step 2: Update `FormationViewRow`'s `instance` prop type to include `loadout_choices`.**

Locate the prop type for `instance`:

```typescript
  instance: {
    instance_id: string;
    formation_string_id: string;
    upgrade_string_ids: string[];
    swap_choices?: Record<string, string>;
  };
```

Replace with:

```typescript
  instance: {
    instance_id: string;
    formation_string_id: string;
    upgrade_string_ids: string[];
    swap_choices?: Record<string, string>;
    loadout_choices?: Record<string, string[]>;
  };
```

- [ ] **Step 3: Add loadout cost to the per-card `totalCost`.**

Find the line that adds the swap delta and append the loadout cost:

```typescript
  totalCost += swapDeltaForFormation(catalog, def, instance.swap_choices);
  totalCost += loadoutCostForFormation(catalog, def, instance.loadout_choices);  // NEW
```

- [ ] **Step 4: Add a composition block showing resolved loadout positions.**

The viewer's `FormationViewRow` already has a section that lists swap-slot choices (from S3.16's fix `f1cd09f`). Find that section and add the loadout-slot rendering after the swap-slot rendering. Look for a JSX block that maps over `def.swap_slots ?? []` and renders `• {slot.label}: {chosenName}` lines. The new block sits next to it.

If the existing swap-slot composition block looks like this:

```tsx
      {swapLines.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {swapLines.map((s) => (
            <li key={s.label}>• {s.label}: {s.chosenName}</li>
          ))}
        </ul>
      )}
```

Replace it with a version that combines both swap and loadout lines:

```tsx
      {(swapLines.length > 0 || loadoutLines.length > 0) && (
        <ul className="mt-2 space-y-1 text-sm">
          {swapLines.map((s) => (
            <li key={`swap-${s.label}`}>• {s.label}: {s.chosenName}</li>
          ))}
          {loadoutLines.map((l) => (
            <li key={`loadout-${l.label}`}>• {l.label}: {l.summary}</li>
          ))}
        </ul>
      )}
```

And before that block, compute `loadoutLines` similarly to `swapLines`:

```tsx
  const loadoutLines: { label: string; summary: string }[] = [];
  for (const slot of def.loadout_slots ?? []) {
    const positions = getLoadoutPositions(catalog, def, instance.loadout_choices, slot.string_id) ?? [];
    if (positions.length === 0) continue;
    const counts = new Map<string, number>();
    for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1);
    const items: string[] = [];
    for (const [stringId, n] of counts) {
      const up = findUpgradeByStringId(catalog, stringId);
      if (!up) continue;
      items.push(n === 1 ? up.name : `${n}x ${up.name}`);
    }
    loadoutLines.push({ label: slot.label, summary: items.join(', ') });
  }
```

Place this `loadoutLines` build just below the existing `swapLines` build.

- [ ] **Step 5: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 6: Run tests.**

Run: `npm test --workspace apps/web`
Expected: passes.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/src/routes/list.\$id.tsx
git commit -m "feat(web): viewer renders loadout positions (screen + print)"
```

---

## Task 9: Server-side Zod body validation for loadout_choices

**Files:**
- Modify: `apps/api/src/trpc/lists.ts`
- Modify: `apps/api/src/__tests__/integration/lists.test.ts`

- [ ] **Step 1: Add failing tests for loadout_choices validation paths.**

Open `apps/api/src/__tests__/integration/lists.test.ts`. The existing test file already has a `TEST_swap_fixture` pattern from S3.16. Extend the fixture to also include a loadout_slot, and add new tests.

Find the existing `TEST_FIXTURE` constant and add a loadout-equipped formation:

```typescript
const TEST_FIXTURE = {
  id: 'TEST swap fixture',
  list_id: TEST_LIST_ID,
  sections: [
    {
      name: 'CORE',
      formations: [
        {
          string_id: 'demi',
          id: 1,
          name: 'Demi-Century',
          pts: 250,
          cost_pts: 250,
          upgrades: [10],
          swap_slots: [
            {
              string_id: 'support',
              label: 'Support unit',
              variants: [
                { upgrade_id: 100, is_default: true },
                { upgrade_id: 101 },
              ],
            },
          ],
        },
        // NEW: loadout-equipped formation
        {
          string_id: 'warlord',
          id: 2,
          name: 'Warlord',
          pts: 725,
          cost_pts: 725,
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
                { upgrade_id: 52 },
              ],
            },
          ],
        },
      ],
    },
  ],
  upgrades: [
    { id: 10, string_id: 'hydra', name: 'Hydra', pts: 50 },
    { id: 50, string_id: 'macro_gatling', name: 'Macro Gatling Blaster', pts: 0 },
    { id: 51, string_id: 'sunfury_plasma', name: 'Sunfury Plasma', pts: 50 },
    { id: 52, string_id: 'power_claw', name: 'Power Claw', pts: 25 },
    { id: 100, string_id: 'gun_servitors', name: 'Gun Servitors', pts: 0 },
    { id: 101, string_id: 'rapier_lasers', name: 'Rapier Lasers', pts: 30 },
  ],
};
```

Then append new tests at the end:

```typescript
test('save accepts a valid loadout_choices body', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    const result = await authed.lists.save.mutate({
      title: 'Loadout test',
      list_id: TEST_LIST_ID,
      body: {
        body_version: 3,
        formations: [{
          instance_id: '01HLOADOUT01',
          formation_string_id: 'warlord',
          upgrade_string_ids: [],
          loadout_choices: { weapons: ['sunfury_plasma', 'power_claw'] },
        }],
      },
    });
    assert.ok(result.id);
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects loadout_choices key that is not a slot on the formation', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad slot',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 3,
          formations: [{
            instance_id: '01HLOADOUT02',
            formation_string_id: 'warlord',
            upgrade_string_ids: [],
            loadout_choices: { nonexistent_slot: ['sunfury_plasma', 'power_claw'] },
          }],
        },
      }),
      /nonexistent_slot|unknown loadout slot|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects loadout_choices variant that is not in the slot', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad variant',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 3,
          formations: [{
            instance_id: '01HLOADOUT03',
            formation_string_id: 'warlord',
            upgrade_string_ids: [],
            loadout_choices: { weapons: ['sunfury_plasma', 'ghost_variant'] },
          }],
        },
      }),
      /ghost_variant|invalid variant|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects loadout position count below min', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Below min',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 3,
          formations: [{
            instance_id: '01HLOADOUT04',
            formation_string_id: 'warlord',
            upgrade_string_ids: [],
            loadout_choices: { weapons: ['sunfury_plasma'] }, // only 1; min=2
          }],
        },
      }),
      /at least 2|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects loadout position count above max', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Above max',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 3,
          formations: [{
            instance_id: '01HLOADOUT05',
            formation_string_id: 'warlord',
            upgrade_string_ids: [],
            loadout_choices: { weapons: ['sunfury_plasma', 'power_claw', 'macro_gatling'] }, // 3; max=2
          }],
        },
      }),
      /at most 2|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects slot key collision across swap_choices and loadout_choices', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Slot collision',
        list_id: TEST_LIST_ID,
        // Use the same slot string_id in both maps on the demi formation
        body: {
          body_version: 3,
          formations: [{
            instance_id: '01HLOADOUT06',
            formation_string_id: 'demi',
            upgrade_string_ids: [],
            swap_choices: { support: 'rapier_lasers' },
            loadout_choices: { support: ['gun_servitors'] }, // same key
          }],
        },
      }),
      /collision|both swap_choices and loadout_choices|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save accepts body_version 3', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);
  const result = await authed.lists.save.mutate({
    title: 'v3 body',
    list_id: VALID_LIST_ID,
    body: { body_version: 3, formations: [] },
  });
  assert.ok(result.id);
  close();
});

test('save body_version 3 round-trips through load', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    const created = await authed.lists.save.mutate({
      title: 'v3 round-trip',
      list_id: TEST_LIST_ID,
      body: {
        body_version: 3,
        formations: [{
          instance_id: '01HLOADOUT07',
          formation_string_id: 'warlord',
          upgrade_string_ids: [],
          loadout_choices: { weapons: ['sunfury_plasma', 'power_claw'] },
        }],
      },
    });
    const loaded = await authed.lists.load.query({ id: created.id });
    const body = loaded.body as { body_version?: number; formations?: Array<{ loadout_choices?: Record<string, string[]> }> };
    assert.strictEqual(body.body_version, 3);
    assert.deepStrictEqual(body.formations?.[0]?.loadout_choices, { weapons: ['sunfury_plasma', 'power_claw'] });
    close();
  } finally {
    await removeTestFixture();
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --workspace apps/api`
Expected: existing tests still pass. The 8 new loadout tests FAIL (the server doesn't validate `loadout_choices` yet, and `body_version: 3` is rejected by the existing Zod union of just `1 | 2`).

- [ ] **Step 3: Update Zod schema in `apps/api/src/trpc/lists.ts`.**

Find the existing `formationBodyShape` and `bodyShape` declarations:

```typescript
const formationBodyShape = z.object({
  instance_id: z.string().min(1),
  formation_string_id: z.string().min(1),
  upgrade_string_ids: z.array(z.string()),
  swap_choices: z.record(z.string(), z.string()).optional(),
});

const bodyShape = z.object({
  body_version: z.union([z.literal(1), z.literal(2)]).optional(),
  formations: z.array(formationBodyShape).optional(),
}).passthrough();
```

Replace with:

```typescript
const formationBodyShape = z.object({
  instance_id: z.string().min(1),
  formation_string_id: z.string().min(1),
  upgrade_string_ids: z.array(z.string()),
  swap_choices: z.record(z.string(), z.string()).optional(),
  loadout_choices: z.record(z.string(), z.array(z.string())).optional(),  // NEW
});

const bodyShape = z.object({
  body_version: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),  // bumped
  formations: z.array(formationBodyShape).optional(),
}).passthrough();
```

- [ ] **Step 4: Add the loadout_choices semantic walk in the save handler.**

Find the existing `save` mutation handler. After the `swap_choices` semantic-check block (the loop that walks each formation's `swap_choices` against the catalog), INSERT a new loadout walk:

```typescript
      // Validate loadout_choices against the referenced list catalog
      if (bodyFormations.some((f) => f.loadout_choices && Object.keys(f.loadout_choices).length > 0)) {
        const cat = await getListCatalog(input.list_id);
        if (!cat) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `list_id catalog not found: ${input.list_id}` });
        }
        for (const f of bodyFormations) {
          if (!f.loadout_choices) continue;
          const formationDef = cat.formationsByStringId.get(f.formation_string_id);
          if (!formationDef) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `unknown formation_string_id '${f.formation_string_id}' in instance '${f.instance_id}'` });
          }
          const loadoutSlotsByStringId = new Map(
            (formationDef.loadout_slots ?? []).map((s) => [s.string_id, s] as const),
          );
          const swapKeys = new Set(Object.keys(f.swap_choices ?? {}));
          for (const [slotKey, positions] of Object.entries(f.loadout_choices)) {
            // Cross-system: no slot key may appear in both maps
            if (swapKeys.has(slotKey)) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `slot key '${slotKey}' on formation '${f.formation_string_id}' appears in both swap_choices and loadout_choices (collision)` });
            }
            const slot = loadoutSlotsByStringId.get(slotKey);
            if (!slot) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `unknown loadout slot '${slotKey}' on formation '${f.formation_string_id}'` });
            }
            // Each variant value must resolve to one of slot.variants[].upgrade.string_id
            const variantStringIds = slot.variants
              .map((v) => cat.upgradesById.get(v.upgrade_id)?.string_id)
              .filter((s): s is string => !!s);
            for (let i = 0; i < positions.length; i++) {
              const v = positions[i]!;
              if (!variantStringIds.includes(v)) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `invalid variant '${v}' at position ${i} for slot '${slotKey}' on formation '${f.formation_string_id}'` });
              }
            }
            // Count bounds
            const minBound = slot.min ?? 0;
            const maxBound = slot.max ?? Infinity;
            if (positions.length < minBound) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `slot '${slotKey}' on formation '${f.formation_string_id}' requires at least ${minBound} selections (got ${positions.length})` });
            }
            if (positions.length > maxBound) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `slot '${slotKey}' on formation '${f.formation_string_id}' allows at most ${maxBound} selections (got ${positions.length})` });
            }
          }
        }
      }
```

Update `apps/api/src/catalog/list-catalog.ts` to include `loadout_slots` in the catalog interface. Open the file and find the `CatalogFormation` interface:

```typescript
export interface CatalogFormation {
  string_id?: string;
  swap_slots?: CatalogSwapSlot[];
  upgrades?: number[];
}
```

Replace with:

```typescript
export interface CatalogFormation {
  string_id?: string;
  swap_slots?: CatalogSwapSlot[];
  loadout_slots?: CatalogLoadoutSlot[];
  upgrades?: number[];
}

export interface CatalogLoadoutVariant {
  upgrade_id: number | string;
  is_default?: boolean;
}

export interface CatalogLoadoutSlot {
  string_id: string;
  label: string;
  min?: number;
  max?: number;
  variants: CatalogLoadoutVariant[];
}
```

(The catalog loader's `getListCatalog` already reads each formation in full via `JSON.parse(...)` — the new `loadout_slots` field passes through with no code changes needed.)

- [ ] **Step 5: Run tests to verify they pass.**

Run: `npm test --workspace apps/api`
Expected: all 75+ existing tests pass; new 8 loadout tests pass.

If `static-routes.test.ts` flakes once on cold start, re-run.

- [ ] **Step 6: Typecheck.**

Run: `npm run typecheck --workspace apps/api`
Expected: passes.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/trpc/lists.ts apps/api/src/catalog/list-catalog.ts apps/api/src/__tests__/integration/lists.test.ts
git commit -m "feat(api): validate loadout_choices and body_version=3 in lists.save"
```

---

## Task 10: Migration script `tools/migrate-loadouts.mjs` (TDD)

**Files:**
- Create: `tools/migrate-loadouts.mjs`
- Create: `tools/test/migrate-loadouts.test.js`
- Create: `tools/test/fixtures/migrate-loadouts/` with 5 fixture files

- [ ] **Step 1: Write the test fixtures.**

`tools/test/fixtures/migrate-loadouts/high-confidence-exactly-input.json` (min=max=N case):

```json
{
  "id": "Exact",
  "list_id": "EXACT",
  "sections": [
    { "name": "CORE", "formations": [{ "string_id": "warlord", "id": 503, "name": "Warlord", "pts": 725, "cost_pts": 725, "upgrades": [] }] }
  ],
  "upgrades": [
    { "id": 50, "string_id": "macro_gatling", "name": "Macro Gatling Blaster", "pts": 0 },
    { "id": 51, "string_id": "sunfury_plasma", "name": "Sunfury Plasma", "pts": 50 },
    { "id": 52, "string_id": "power_claw", "name": "Power Claw", "pts": 25 }
  ],
  "upgradeConstraints": [
    { "min": 2, "max": 2, "from": [50, 51, 52], "appliesTo": [503] }
  ]
}
```

`tools/test/fixtures/migrate-loadouts/high-confidence-exactly-output.json` (expected after transform):

```json
{
  "id": "Exact",
  "list_id": "EXACT",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "warlord",
          "id": 503,
          "name": "Warlord",
          "pts": 725,
          "cost_pts": 725,
          "upgrades": [],
          "loadout_slots": [
            {
              "string_id": "loadout_macro_gatling_or_sunfury_plasma_or_power_claw",
              "label": "Choice",
              "min": 2,
              "max": 2,
              "variants": [
                { "upgrade_id": 50, "is_default": true },
                { "upgrade_id": 51 },
                { "upgrade_id": 52 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 50, "string_id": "macro_gatling", "name": "Macro Gatling Blaster", "pts": 0 },
    { "id": 51, "string_id": "sunfury_plasma", "name": "Sunfury Plasma", "pts": 50 },
    { "id": 52, "string_id": "power_claw", "name": "Power Claw", "pts": 25 }
  ],
  "upgradeConstraints": [
    { "min": 2, "max": 2, "from": [50, 51, 52], "appliesTo": [503] }
  ]
}
```

`tools/test/fixtures/migrate-loadouts/high-confidence-up-to-input.json` (max-only case, no default):

```json
{
  "id": "UpTo",
  "list_id": "UPTO",
  "sections": [
    { "name": "CORE", "formations": [{ "string_id": "inf", "id": 100, "name": "Infantry", "pts": 200, "cost_pts": 200, "upgrades": [] }] }
  ],
  "upgrades": [
    { "id": 10, "string_id": "hydra", "name": "Hydra", "pts": 50 },
    { "id": 11, "string_id": "manticore", "name": "Manticore", "pts": 100 }
  ],
  "upgradeConstraints": [
    { "max": 2, "from": [10, 11], "appliesTo": [100] }
  ]
}
```

`tools/test/fixtures/migrate-loadouts/high-confidence-up-to-output.json`:

```json
{
  "id": "UpTo",
  "list_id": "UPTO",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "inf",
          "id": 100,
          "name": "Infantry",
          "pts": 200,
          "cost_pts": 200,
          "upgrades": [],
          "loadout_slots": [
            {
              "string_id": "loadout_hydra_or_manticore",
              "label": "Choice",
              "max": 2,
              "variants": [
                { "upgrade_id": 10 },
                { "upgrade_id": 11 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 10, "string_id": "hydra", "name": "Hydra", "pts": 50 },
    { "id": 11, "string_id": "manticore", "name": "Manticore", "pts": 100 }
  ],
  "upgradeConstraints": [
    { "max": 2, "from": [10, 11], "appliesTo": [100] }
  ]
}
```

`tools/test/fixtures/migrate-loadouts/medium-overlap-input.json` (variant in formation's upgrades[]):

```json
{
  "id": "Overlap",
  "list_id": "OVERLAP",
  "sections": [
    { "name": "CORE", "formations": [{ "string_id": "f", "id": 1, "name": "F", "pts": 100, "cost_pts": 100, "upgrades": [10] }] }
  ],
  "upgrades": [
    { "id": 10, "string_id": "a", "name": "A", "pts": 0 },
    { "id": 11, "string_id": "b", "name": "B", "pts": 0 }
  ],
  "upgradeConstraints": [
    { "min": 2, "max": 2, "from": [10, 11], "appliesTo": [1] }
  ]
}
```

`tools/test/fixtures/migrate-loadouts/skip-min-max-1-input.json` (silent skip — handled by migrate-swaps, not migrate-loadouts):

```json
{
  "id": "MinMax1",
  "list_id": "MINMAX1",
  "sections": [
    { "name": "CORE", "formations": [{ "string_id": "f", "id": 1, "name": "F", "pts": 100, "cost_pts": 100, "upgrades": [] }] }
  ],
  "upgrades": [
    { "id": 10, "string_id": "a", "name": "A", "pts": 0 },
    { "id": 11, "string_id": "b", "name": "B", "pts": 0 }
  ],
  "upgradeConstraints": [
    { "min": 1, "max": 1, "from": [10, 11], "appliesTo": [1] }
  ]
}
```

- [ ] **Step 2: Write the test file.**

`tools/test/migrate-loadouts.test.js`:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FIX = path.resolve(__dirname, 'fixtures', 'migrate-loadouts');

async function runTransform(fileName) {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, fileName), 'utf8'));
  return transformList(input);
}

test('high-confidence exactly-N: emits loadout_slot with default cheapest', async () => {
  const { json, report } = await runTransform('high-confidence-exactly-input.json');
  const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-exactly-output.json'), 'utf8'));
  assert.deepStrictEqual(json, expected);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'high');
});

test('high-confidence up-to-N: emits loadout_slot without default', async () => {
  const { json, report } = await runTransform('high-confidence-up-to-input.json');
  const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-up-to-output.json'), 'utf8'));
  assert.deepStrictEqual(json, expected);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'high');
});

test('medium-confidence (variant in formation.upgrades[]): no transform, report row emitted', async () => {
  const { json, report } = await runTransform('medium-overlap-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'medium-overlap-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'medium');
});

test('skip silently: min=max=1 is migrate-swaps territory', async () => {
  const { json, report } = await runTransform('skip-min-max-1-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'skip-min-max-1-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original);
  assert.strictEqual(report.length, 0);
});

test('idempotency: running transform twice yields the same result', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-exactly-input.json'), 'utf8'));
  const first = transformList(input);
  const second = transformList(first.json);
  assert.deepStrictEqual(second.json, first.json);
  assert.strictEqual(second.report.length, 0);
});

test('partial migration: applies to formations missing the slot only', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = {
    id: 'Partial', list_id: 'PARTIAL',
    sections: [{ name: 'CORE', formations: [
      { string_id: 'f1', id: 1, name: 'F1', pts: 100, cost_pts: 100, upgrades: [],
        loadout_slots: [{ string_id: 'loadout_a_or_b', label: 'Choice', min: 2, max: 2,
          variants: [{ upgrade_id: 10, is_default: true }, { upgrade_id: 11 }] }] },
      { string_id: 'f2', id: 2, name: 'F2', pts: 100, cost_pts: 100, upgrades: [] },
    ] }],
    upgrades: [{ id: 10, string_id: 'a', name: 'A', pts: 0 }, { id: 11, string_id: 'b', name: 'B', pts: 0 }],
    upgradeConstraints: [{ min: 2, max: 2, from: [10, 11], appliesTo: [1, 2] }],
  };
  const { json, report } = transformList(input);
  const f1 = json.sections[0].formations[0];
  const f2 = json.sections[0].formations[1];
  assert.strictEqual(f1.loadout_slots.length, 1, 'F1 must not get a duplicate slot');
  assert.ok(Array.isArray(f2.loadout_slots) && f2.loadout_slots.length === 1, 'F2 should have the slot applied');
  const highRows = report.filter((r) => r.tier === 'high');
  assert.strictEqual(highRows.length, 1);
  assert.deepStrictEqual(highRows[0].formationIds, [2]);
});

test('cross-system overlap with swap_slot variant → medium', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = {
    id: 'CrossSystem', list_id: 'CROSSSYS',
    sections: [{ name: 'CORE', formations: [
      { string_id: 'f', id: 1, name: 'F', pts: 100, cost_pts: 100, upgrades: [],
        swap_slots: [{ string_id: 'sw', label: 'Swap',
          variants: [{ upgrade_id: 10, is_default: true }, { upgrade_id: 11 }] }] },
    ] }],
    upgrades: [{ id: 10, string_id: 'a', name: 'A', pts: 0 }, { id: 11, string_id: 'b', name: 'B', pts: 0 }, { id: 12, string_id: 'c', name: 'C', pts: 0 }],
    upgradeConstraints: [{ min: 2, max: 2, from: [10, 12], appliesTo: [1] }],
  };
  const { report } = transformList(input);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'medium');
});

test('truncation collision dedupe: two long constraints get unique string_ids', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  // Construct variant string_ids that force a truncation collision at slice(0, 80).
  // Candidate slot string_id = `loadout_<longA>_or_<longB>` (8 + 50 + 4 + 50+ chars).
  // The first 80 chars are: "loadout_" + 50 a's + "_or_" + 18 b's. Both constraints
  // share that prefix; their differentiating suffix (_alpha vs _beta) starts past
  // position 80, so without dedupe they'd produce identical string_ids.
  const longA = 'a'.repeat(50);
  const longB1 = 'b'.repeat(50) + '_alpha';
  const longB2 = 'b'.repeat(50) + '_beta';
  const input = {
    id: 'Trunc', list_id: 'TRUNC',
    sections: [{ name: 'CORE', formations: [{ string_id: 'f', id: 1, name: 'F', pts: 100, cost_pts: 100, upgrades: [] }] }],
    upgrades: [
      { id: 10, string_id: longA, name: 'A', pts: 0 },
      { id: 11, string_id: longB1, name: 'B1', pts: 0 },
      { id: 12, string_id: longB2, name: 'B2', pts: 0 },
    ],
    upgradeConstraints: [
      { min: 2, max: 2, from: [10, 11], appliesTo: [1] },
      { min: 2, max: 2, from: [10, 12], appliesTo: [1] },
    ],
  };
  const { json } = transformList(input);
  const slots = json.sections[0].formations[0].loadout_slots;
  assert.strictEqual(slots.length, 2);
  assert.notStrictEqual(slots[0].string_id, slots[1].string_id);
});

test('high-confidence default heuristic: cheapest wins; first-in-from breaks ties', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = {
    id: 'Tiebreak', list_id: 'TIE',
    sections: [{ name: 'CORE', formations: [{ string_id: 'f', id: 1, name: 'F', pts: 100, cost_pts: 100, upgrades: [] }] }],
    upgrades: [
      { id: 20, string_id: 'first_cheap', name: 'First Cheap', pts: 0 },
      { id: 21, string_id: 'second_cheap', name: 'Second Cheap', pts: 0 },  // also 0
      { id: 22, string_id: 'expensive', name: 'Expensive', pts: 50 },
    ],
    upgradeConstraints: [{ min: 2, max: 2, from: [22, 21, 20], appliesTo: [1] }],
  };
  // Variants ordered [22, 21, 20]: cheapest are 21 and 20 (both 0). First listed in `from[]`
  // among those is 21. So default should be 21.
  const { json } = transformList(input);
  const slot = json.sections[0].formations[0].loadout_slots[0];
  const defaultVariant = slot.variants.find((v) => v.is_default);
  assert.strictEqual(defaultVariant.upgrade_id, 21);
});
```

- [ ] **Step 3: Run the tests to verify they fail.**

Run: `node --test tools/test/migrate-loadouts.test.js`
Expected: FAIL with "Cannot find module '../migrate-loadouts.mjs'".

- [ ] **Step 4: Write `tools/migrate-loadouts.mjs`.**

```javascript
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LISTS_DIR = path.join(REPO_ROOT, 'war', 'lists');

/**
 * Pure transform: given a parsed list JSON, return a new JSON with loadout_slots added
 * for high-confidence upgradeConstraints rows where min/max != 1, plus a report.
 *
 * Does NOT remove the original upgradeConstraints rows (legacy chooser-html keeps reading them).
 * Idempotent: re-running on output is a no-op.
 */
export function transformList(input) {
  const json = JSON.parse(JSON.stringify(input)); // deep clone
  const report = [];
  const constraints = Array.isArray(json.upgradeConstraints) ? json.upgradeConstraints : [];
  if (constraints.length === 0) return { json, report };

  const upgradesById = new Map((json.upgrades ?? []).map((u) => [u.id, u]));
  const formationsByIdMap = new Map();
  for (const section of json.sections ?? []) {
    for (const f of section.formations ?? []) {
      if (typeof f.id === 'number' || typeof f.id === 'string') formationsByIdMap.set(f.id, f);
    }
  }

  for (const c of constraints) {
    // Skip: migrate-swaps handles min=max=1
    if (c.min === 1 && c.max === 1) continue;
    // Skip: malformed
    if (!Array.isArray(c.from) || c.from.length < 1) continue;
    if (!Array.isArray(c.appliesTo) || c.appliesTo.length === 0) continue;

    // Resolve from-upgrades; all must exist
    const fromUpgrades = c.from.map((id) => upgradesById.get(id));
    if (fromUpgrades.some((u) => !u)) {
      report.push({ tier: 'medium', reason: 'from references unknown upgrade', constraint: c });
      continue;
    }

    // Determine default per pattern:
    //   - min=max=N, min=N+open, range A..B: cheapest variant (first listed breaks ties)
    //   - min=undef/max-only: no default
    const minSet = typeof c.min === 'number' && c.min >= 1;
    const maxSet = typeof c.max === 'number';
    const needDefault = minSet; // any pattern where min >= 1
    let defaultUpgradeId = null;
    if (needDefault) {
      let cheapestPts = Infinity;
      for (const id of c.from) {
        const u = upgradesById.get(id);
        const pts = u?.cost_pts ?? u?.pts ?? 0;
        if (pts < cheapestPts) {
          cheapestPts = pts;
          defaultUpgradeId = id;
        }
      }
      // Tiebreaker: lowest pts ties → first in c.from. The loop above already picks the
      // FIRST occurrence of the cheapest value (because `<` not `<=`), so first-in-from wins.
    }

    // Pre-compute candidate slot string_id (deduped per-formation below)
    const variantStringIds = c.from.map((id) => upgradesById.get(id)?.string_id ?? String(id));
    const candidateSlotStringId = `loadout_${variantStringIds.join('_or_')}`.slice(0, 80);

    const appliedFormations = [];
    const skippedFormations = [];
    let blockedFormations = 0;
    for (const formationId of c.appliesTo) {
      const f = formationsByIdMap.get(formationId);
      if (!f) {
        report.push({ tier: 'medium', reason: `appliesTo formation ${formationId} not found`, constraint: c });
        blockedFormations++;
        continue;
      }
      const formationUpgradeIds = new Set(f.upgrades ?? []);
      const overlap = c.from.filter((id) => formationUpgradeIds.has(id));
      if (overlap.length > 0) {
        report.push({
          tier: 'medium',
          reason: `variant(s) ${overlap.join(',')} also in formation ${formationId} upgrades[]`,
          constraint: c,
        });
        blockedFormations++;
        continue;
      }
      // Cross-system check: variants in any sibling swap_slot.variants[]
      const swapSlotUpgradeIds = new Set();
      for (const ss of f.swap_slots ?? []) {
        for (const v of ss.variants ?? []) swapSlotUpgradeIds.add(v.upgrade_id);
      }
      const swapOverlap = c.from.filter((id) => swapSlotUpgradeIds.has(id));
      if (swapOverlap.length > 0) {
        report.push({
          tier: 'medium',
          reason: `variant(s) ${swapOverlap.join(',')} also in swap_slot on formation ${formationId} (cross-system)`,
          constraint: c,
        });
        blockedFormations++;
        continue;
      }
      // Idempotency: a loadout_slot already covers this exact from-set with matching min/max
      const existingSlot = (f.loadout_slots ?? []).find((s) =>
        Array.isArray(s.variants) &&
        s.variants.length === c.from.length &&
        c.from.every((id) => s.variants.some((v) => v.upgrade_id === id)) &&
        s.min === c.min &&
        s.max === c.max
      );
      if (existingSlot) {
        skippedFormations.push(formationId);
        continue;
      }

      // Apply: add loadout_slot to this formation.
      f.loadout_slots = f.loadout_slots ?? [];
      let slotStringId = candidateSlotStringId;
      // Dedupe against existing loadout_slots AND swap_slots on the formation
      const existingStringIds = new Set([
        ...(f.loadout_slots.map((s) => s.string_id) || []),
        ...(f.swap_slots?.map((s) => s.string_id) || []),
      ]);
      if (existingStringIds.has(slotStringId)) {
        let n = 2;
        while (existingStringIds.has(`${slotStringId}_${n}`)) n++;
        slotStringId = `${slotStringId}_${n}`;
      }
      const variants = c.from.map((id) => ({
        upgrade_id: id,
        ...(id === defaultUpgradeId ? { is_default: true } : {}),
      }));
      const slotObj = {
        string_id: slotStringId,
        label: 'Choice',
        variants,
      };
      if (typeof c.min === 'number' && c.min > 0) slotObj.min = c.min;
      if (typeof c.max === 'number') slotObj.max = c.max;
      // Insert min/max BEFORE variants for readability; rebuild the object
      const orderedSlot = {
        string_id: slotObj.string_id,
        label: slotObj.label,
        ...(typeof slotObj.min === 'number' ? { min: slotObj.min } : {}),
        ...(typeof slotObj.max === 'number' ? { max: slotObj.max } : {}),
        variants: slotObj.variants,
      };
      f.loadout_slots.push(orderedSlot);
      appliedFormations.push(formationId);
    }

    if (appliedFormations.length > 0) {
      report.push({
        tier: 'high',
        formationIds: appliedFormations,
        fromUpgradeIds: [...c.from],
        defaultUpgradeId,
        ...(skippedFormations.length > 0 ? { alreadyMigratedFormations: skippedFormations } : {}),
      });
    }
  }
  return { json, report };
}

// CLI entry
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  const entries = await fs.readdir(LISTS_DIR);
  let totalHigh = 0, totalMedium = 0;
  for (const fname of entries) {
    if (!fname.endsWith('.json')) continue;
    const filePath = path.join(LISTS_DIR, fname);
    let parsed;
    try {
      parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      continue;
    }
    const { json, report } = transformList(parsed);
    for (const r of report) {
      if (r.tier === 'high') totalHigh++;
      else if (r.tier === 'medium') totalMedium++;
      console.log(`${fname}\t${r.tier}\t${JSON.stringify(r)}`);
    }
    const willChange = report.some((r) => r.tier === 'high');
    if (willChange && mode === 'apply') {
      await fs.writeFile(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    }
  }
  console.log(`\nSummary: ${totalHigh} auto-applied, ${totalMedium} manual-review. Mode: ${mode}.`);
  if (mode !== 'apply') console.log('Re-run with --apply to write changes.');
}
```

- [ ] **Step 5: Run tests to verify they pass.**

Run: `node --test tools/test/migrate-loadouts.test.js`
Expected: all 9 tests pass.

- [ ] **Step 6: Dry-run against real list files.**

Run: `node tools/migrate-loadouts.mjs 2>&1 | tail -3`
Expected: summary like `Summary: N auto-applied, M manual-review. Mode: dry-run.` with substantial N (likely ~600+ if we apply to all min=max=N + max-only patterns; not exact — capture whatever it reports). Confirm `git status` is clean afterward.

- [ ] **Step 7: Commit.**

```bash
git add tools/migrate-loadouts.mjs tools/test/migrate-loadouts.test.js tools/test/fixtures/migrate-loadouts/
git commit -m "feat(tools): add migrate-loadouts script (dry-run + apply, tiered classification)"
```

---

## Task 11: Apply Gryphonne-equivalent worked reference case

**Files:**
- Modify: `war/lists/AMTL_Adeptus_Titanicus_EPICUK.json`

This task applies the migration to ONE specific constraint as the worked reference case. **CRITICAL:** the migration script's `--apply` mode would write ALL high-confidence constraints in the file at once. In S3.16's Task 11, this caused scope creep (3 formations migrated when 1 was intended). This task uses an inline node command to apply only to the target constraint.

- [ ] **Step 1: Inspect the file to identify the target constraint.**

Run: `node tools/migrate-loadouts.mjs 2>&1 | grep AMTL_Adeptus_Titanicus_EPICUK | head -10`

Expected: a few lines listing high/medium classifications for that file. Identify the Warlord Battle Titan constraint (it'll have a high-tier row with `formationIds` including the Warlord's id and `fromUpgradeIds` listing several weapon upgrade IDs like 50, 51, etc.).

- [ ] **Step 2: Note the target constraint's exact shape.**

Open `war/lists/AMTL_Adeptus_Titanicus_EPICUK.json` and search for `"upgradeConstraints"`. Find the row whose `appliesTo` includes the Warlord Battle Titan's `id` (the formation named "Warlord Battle Titan"). Its `from[]` will list the weapon-option upgrade IDs (Macro Gatling Blaster, Sunfury Plasma Annihilator, etc.). Note the constraint's `min`, `max`, `from`, and `appliesTo` values — you'll target this specific constraint in step 3.

- [ ] **Step 3: Apply migration to ONLY the Warlord constraint via inline transform.**

Run a one-off inline transform that filters to constraints targeting the Warlord formation. Adapt the `appliesTo` filter to the specific id you noted:

```bash
node --input-type=module -e "
import('./tools/migrate-loadouts.mjs').then(async (m) => {
  const fs = await import('node:fs/promises');
  const p = './war/lists/AMTL_Adeptus_Titanicus_EPICUK.json';
  const j = JSON.parse(await fs.readFile(p, 'utf8'));
  // Filter: keep only constraints whose appliesTo includes the WARLORD's id (replace 503 with the actual id from step 2)
  const WARLORD_ID = 503;  // <-- update this if different
  const filteredJson = { ...j, upgradeConstraints: (j.upgradeConstraints || []).filter(c => Array.isArray(c.appliesTo) && c.appliesTo.includes(WARLORD_ID) && !(c.min === 1 && c.max === 1)) };
  // Run the transform on the filtered list — only Warlord-related constraints will produce loadout_slots
  const { json: transformed, report } = m.transformList(filteredJson);
  console.log('REPORT:', JSON.stringify(report, null, 2));
  // Merge back: take j as base, copy transformed.sections (which has the new loadout_slots) onto j
  // We want to ONLY touch the Warlord formation. Find it and replace.
  for (const section of j.sections || []) {
    for (let i = 0; i < section.formations.length; i++) {
      if (section.formations[i].id === WARLORD_ID) {
        // Find the transformed version
        for (const ts of transformed.sections || []) {
          const tf = (ts.formations || []).find(f => f.id === WARLORD_ID);
          if (tf) section.formations[i] = tf;
        }
      }
    }
  }
  await fs.writeFile(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('WROTE:', p);
});
"
```

Expected: the `REPORT` output shows ONE high-tier row for the Warlord. The file is rewritten with `loadout_slots[]` added to the Warlord formation only.

- [ ] **Step 4: Verify the change is surgical.**

Run: `git diff war/lists/AMTL_Adeptus_Titanicus_EPICUK.json | head -50`
Expected: the diff shows additions ONLY inside the Warlord Battle Titan formation block — no other formations modified, no `upgradeConstraints` rows changed. If you see changes outside the Warlord block, revert and re-run more carefully:

```bash
git checkout war/lists/AMTL_Adeptus_Titanicus_EPICUK.json
```

Then re-run step 3 with a more careful approach (e.g., narrowing the WARLORD_ID).

- [ ] **Step 5: Hand-edit the slot label from "Choice" to "Weapons".**

Open `war/lists/AMTL_Adeptus_Titanicus_EPICUK.json`, find the new `loadout_slots[]` block on the Warlord formation, and change `"label": "Choice"` to `"label": "Weapons"`.

- [ ] **Step 6: Verify the validator still passes.**

Run: `node tools/validate-lists.mjs`
Expected: `OK: 156 files`.

- [ ] **Step 7: Run all tests.**

Run: `npm test`
Expected: all workspaces green. If `static-routes.test.ts` flakes once, re-run.

- [ ] **Step 8: Commit.**

```bash
git add war/lists/AMTL_Adeptus_Titanicus_EPICUK.json
git commit -m "feat(data): add loadout_slots to Warlord Battle Titan as worked reference case"
```

---

## Task 12: Final integration check

**Files:** none (verification only)

- [ ] **Step 1: Full root test.**

Run: `npm test`
Expected: every workspace's tests pass. (Re-run once if `static-routes.test.ts` flakes.)

- [ ] **Step 2: Full root typecheck.**

Run: `npm run typecheck && npm run typecheck --workspace apps/web`
Expected: both pass.

- [ ] **Step 3: Web build.**

Run: `npm run build --workspace apps/web`
Expected: vite build completes, tsc emits no errors.

- [ ] **Step 4: Manual smoke test (Task 11 Step 4 of design spec §6).**

This step is for the human controller after the branch is merged + GoDaddy redeployed. Note in your report that automated paths are green and the manual smoke test is pending.

- [ ] **Step 5: Note redeploy in handoff.**

After the merge to master, remind the user that GoDaddy doesn't auto-deploy — they need to click Redeploy in the airoapp.ai UI. (Reference: `reference_godaddy-deploy.md` memory.)

---

## Out of scope for this plan (per spec §7)

- Intra-unit weapon-loadout swap as a *separate* primitive — this plan IS that primitive (the spec recasts "intra-unit weapon swaps" as "loadout slots" because it's more general).
- Constraint enforcement of `upgradeConstraints` rows that don't fit the loadout-slot shape (compound rules, `perArmy: true`, etc.).
- Hand-curation of `"Choice"` labels across the broader backfill — after this plan lands, the user can run `node tools/migrate-loadouts.mjs --apply` and the optional `tools/relabel-loadout-slots.mjs` (not built here) to mass-migrate the remaining 900+ constraints. Each PR per faction.
- S1.16 parsed weapon stats — would enable richer chip popovers showing weapon range/firepower. Follow-up.
- S1.17 typed upgrade `kind` — would smarten the migration's label heuristic.
- Per-faction backfill of the remaining ~900 loadout candidates beyond the worked Warlord case.
- Stage-4 mobile UI adjustments — chip-popover is touch-friendly; future work.
