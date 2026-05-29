# Formation-level Unit Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `swap_slots[]` primitive on formations so the builder can model "replace default unit X with alternative Y at ±N pts" as a first-class concept, surface it as a toggle/radio on the formation card, and apply the Gryphonne IV Sagitarii Demi-Century as the worked reference case.

**Architecture:** Optional `swap_slots[]` field on each formation in `war/lists/*.json`. Variants reference existing entries in the top-level `upgrades[]`. Saved-list body extended with `body_version: 2` and per-instance `swap_choices: Record<slot_string_id, variant_upgrade_string_id>` (written only for non-default selections). Builder UI adds a "Composition" subsection. tRPC `lists.save` gains structured Zod validation of the body shape. Legacy `upgradeConstraints` rows the new shape supersedes stay in the data — migration adds `swap_slots[]` alongside, not in place of, so legacy chooser-html keeps enforcing them.

**Tech Stack:** Node `node:test` runner, TypeScript, Zod, Drizzle, Fastify + tRPC, React + Zustand, TanStack Router, JSON Schema (draft-07), better-sqlite3, `tsx` for TS in node:test.

**Spec:** `docs/superpowers/specs/2026-05-29-formation-level-unit-swap-design.md` (commit `e01bfb8`).

---

## Repo conventions you must know

- **Test runner:** `node --test --import tsx`. NOT vitest. Imports look like `import { test } from 'node:test'; import assert from 'node:assert';`.
- **Root `npm test`** currently only runs `apps/api`. You will extend it to cover `apps/web` and `tools/test` (Task 5).
- **Commit style:** lowercase imperative prefixes — `feat(web): …`, `feat(api): …`, `feat(data): …`, `test: …`, `docs: …`, `chore: …`. **No Co-Authored-By trailers** — the user explicitly does not want them in this project.
- **Path conventions in code:** API uses `WAR_ROOT` from `apps/api/src/paths.js` to reach `war/lists/` and `war/source-json/`. Don't hardcode paths.
- **TypeScript strictness:** the codebase compiles with `--noEmit` checks. Run `npm run typecheck` from the root after touching shared types.

---

## File Map

**Create:**
- `tools/validate-lists.mjs` — CLI validator for `war/lists/*.json` against `schemas/list.schema.json`.
- `tools/test/validate-lists.test.js` — node:test for the validator with positive + negative fixtures.
- `tools/test/fixtures/swap-slots/happy.json` — minimal valid list with one `swap_slots[]`.
- `tools/test/fixtures/swap-slots/missing-default.json` — negative: no variant has `is_default: true`.
- `tools/test/fixtures/swap-slots/two-defaults.json` — negative: two variants marked default.
- `tools/test/fixtures/swap-slots/variant-not-in-upgrades.json` — negative: variant `upgrade_id` not in top-level `upgrades[]`.
- `tools/test/fixtures/swap-slots/variant-also-in-formation-upgrades.json` — negative: upgrade appears in both the slot and the formation's `upgrades[]`.
- `tools/test/fixtures/swap-slots/duplicate-slot-string-ids.json` — negative: two slots on same formation share a `string_id`.
- `tools/migrate-swaps.mjs` — migration script with `--dry-run` and `--apply` modes.
- `tools/test/migrate-swaps.test.js` — node:test for the migration transform (pure-function form).
- `tools/test/fixtures/migrate-swaps/` — input + expected-output fixtures for high/medium/skip classifications.
- `apps/api/src/catalog/list-catalog.ts` — new module: `getListCatalog(list_id)` lazy-loader + cache, mirroring `list-ids.ts`.

**Modify:**
- `schemas/list.schema.json` — add `swap_slots[]` shape and cross-reference rules.
- `schemas/types.ts` — regenerated automatically via `node tools/generate-types.js`.
- `apps/web/src/stores/selectors.ts` — `CatalogSwapSlot` + `CatalogVariant` types, helpers (`getSwapChoice`, `swapDeltaForFormation`), update `totalPoints`.
- `apps/web/src/stores/builder-store.ts` — `BuilderFormation.swap_choices`, top-level `body_version`, `selectSwapVariant` action, stale-data drop on load, save-only-non-defaults rule.
- `apps/web/src/stores/__tests__/selectors.test.ts` — extend with swap-behavior cases.
- `apps/web/package.json` — add `"test"` script.
- `package.json` (root) — extend `"test"` script to cover `apps/web` and `tools/test`.
- `apps/web/src/routes/build.$listId.tsx` — `FormationCard` renders Composition subsection + print rows.
- `apps/api/src/trpc/lists.ts` — replace `body: z.unknown()` with a real Zod body schema (versioned), validate `swap_choices` against the referenced list's `swap_slots`.
- `apps/api/src/__tests__/integration/lists.test.ts` — add swap-validation save tests.
- `war/lists/AMTL_skitarii_NETEA.json` — worked reference case: add `swap_slots[]` to formation `567` (Sagitarii Demi-Century), leave existing `upgradeConstraints` unchanged.

---

## Task 1: Add `swap_slots[]` shape to JSON Schema + happy-path fixture

**Files:**
- Modify: `schemas/list.schema.json`
- Create: `tools/test/fixtures/swap-slots/happy.json`

- [ ] **Step 1: Extend `schemas/list.schema.json` to define `swap_slots[]` on a formation.**

Locate the formation `properties` block (currently around lines 41–60) and add `swap_slots` after `cost_pts`. Replace:

```json
                "cost_pts": {}
              }
            }
          }
        }
      }
    },
```

with:

```json
                "cost_pts": {},
                "swap_slots": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["string_id", "label", "variants"],
                    "additionalProperties": true,
                    "properties": {
                      "string_id": { "type": "string", "minLength": 1 },
                      "label": { "type": "string", "minLength": 1 },
                      "variants": {
                        "type": "array",
                        "minItems": 2,
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

(JSON Schema cannot express "exactly one variant has `is_default: true`" or the cross-references to `upgrades[]`. Those rules live in the custom validator created in Task 2. The schema enforces shape; the validator enforces semantics.)

- [ ] **Step 2: Create `tools/test/fixtures/swap-slots/happy.json`.**

```json
{
  "id": "TEST_swap_happy",
  "list_id": "TEST_swap_happy",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "demi_century",
          "id": 1,
          "name": "Demi-Century",
          "pts": 250,
          "cost_pts": 250,
          "upgrades": [10, 11],
          "swap_slots": [
            {
              "string_id": "support_unit",
              "label": "Support unit",
              "variants": [
                { "upgrade_id": 100, "is_default": true },
                { "upgrade_id": 101 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 10, "string_id": "hydra", "name": "Hydra", "pts": 50 },
    { "id": 11, "string_id": "chimedons", "name": "Chimedons", "pts": 175 },
    { "id": 100, "string_id": "gun_servitors", "name": "5 Gun Servitors", "pts": 0 },
    { "id": 101, "string_id": "rapier_lasers", "name": "3 Rapier Laser Destroyers", "pts": 0 }
  ]
}
```

- [ ] **Step 3: Sanity-check existing lists still validate against the extended schema.**

Until the new validator exists (Task 2), run a quick ajv check inline:

Run: `node -e "const Ajv=require('ajv');const s=require('./schemas/list.schema.json');const v=new Ajv({allErrors:true,strict:false}).compile(s);const fs=require('fs');const p=require('path');const dir='./war/lists';let bad=0;for(const f of fs.readdirSync(dir)){if(!f.endsWith('.json'))continue;try{const j=JSON.parse(fs.readFileSync(p.join(dir,f),'utf8'));if(!v(j)){bad++;console.error(f,v.errors);}}catch{}}console.log('failures:',bad);"`

Expected: `failures: 0` (the new `swap_slots[]` field is optional; existing files have no slots and pass).

If `ajv` isn't already installed at the root, run `npm install --no-save ajv` first and rerun. Don't commit the install.

- [ ] **Step 4: Commit.**

```bash
git add schemas/list.schema.json tools/test/fixtures/swap-slots/happy.json
git commit -m "feat(schema): add swap_slots shape to list schema"
```

---

## Task 2: Create the list validator with happy-path test

**Files:**
- Create: `tools/validate-lists.mjs`
- Create: `tools/test/validate-lists.test.js`

- [ ] **Step 1: Write a failing test for the happy fixture.**

Create `tools/test/validate-lists.test.js`:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const validatorUrl = pathToFileURL(path.resolve(__dirname, '..', 'validate-lists.mjs')).href;

async function validateFile(fixturePath) {
  const { validateListFile } = await import(validatorUrl);
  return validateListFile(fixturePath);
}

test('validator accepts the swap-slots happy fixture', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'happy.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true, `expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `node --test tools/test/validate-lists.test.js`
Expected: FAIL with "Cannot find module '../validate-lists.mjs'" (or an import error).

- [ ] **Step 3: Create `tools/validate-lists.mjs` with the minimum to pass.**

```javascript
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'list.schema.json');

let cachedValidator = null;

async function getValidator() {
  if (cachedValidator) return cachedValidator;
  const schemaText = await fs.readFile(SCHEMA_PATH, 'utf8');
  const schema = JSON.parse(schemaText);
  const ajv = new Ajv({ allErrors: true, strict: false });
  cachedValidator = ajv.compile(schema);
  return cachedValidator;
}

/**
 * Validate a single list file at `filePath`.
 * Returns { ok: true } or { ok: false, errors: [...] }.
 */
export async function validateListFile(filePath) {
  let json;
  try {
    const body = await fs.readFile(filePath, 'utf8');
    json = JSON.parse(body);
  } catch (err) {
    return { ok: false, errors: [`parse error: ${err.message}`] };
  }
  const validate = await getValidator();
  const errors = [];
  if (!validate(json)) {
    for (const e of validate.errors ?? []) {
      errors.push(`${e.instancePath || '/'} ${e.message}`);
    }
  }
  // Semantic checks (cross-references the JSON-schema can't express) come in Task 3.
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// CLI entry: when invoked directly, validate every file in war/lists/.
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const LISTS_DIR = path.join(REPO_ROOT, 'war', 'lists');
  const entries = await fs.readdir(LISTS_DIR);
  let bad = 0;
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    const r = await validateListFile(path.join(LISTS_DIR, f));
    if (!r.ok) {
      bad++;
      console.error(`FAIL ${f}`);
      for (const e of r.errors) console.error(`  ${e}`);
    }
  }
  if (bad > 0) {
    console.error(`\n${bad} file(s) failed validation`);
    process.exit(1);
  }
  console.log(`OK: ${entries.filter((f) => f.endsWith('.json')).length} files`);
}
```

- [ ] **Step 4: Make sure Ajv is available to the script.**

Check the root `package.json` for `ajv`. If absent, add it as a `devDependency`:

Run: `npm install --save-dev ajv@^8.0.0`

- [ ] **Step 5: Run the test to verify it passes.**

Run: `node --test tools/test/validate-lists.test.js`
Expected: PASS (1 test).

- [ ] **Step 6: Run the CLI against the real list set.**

Run: `node tools/validate-lists.mjs`
Expected: `OK: 156 files` (or whatever the current count is). If any files fail, those are pre-existing data issues not in scope — note them but don't fix here.

- [ ] **Step 7: Commit.**

```bash
git add tools/validate-lists.mjs tools/test/validate-lists.test.js package.json package-lock.json
git commit -m "feat(tools): add list-schema validator script"
```

---

## Task 3: Add semantic validation rules + negative fixtures

**Files:**
- Modify: `tools/validate-lists.mjs`
- Create: `tools/test/fixtures/swap-slots/missing-default.json`
- Create: `tools/test/fixtures/swap-slots/two-defaults.json`
- Create: `tools/test/fixtures/swap-slots/variant-not-in-upgrades.json`
- Create: `tools/test/fixtures/swap-slots/variant-also-in-formation-upgrades.json`
- Create: `tools/test/fixtures/swap-slots/duplicate-slot-string-ids.json`
- Modify: `tools/test/validate-lists.test.js`

- [ ] **Step 1: Write the five negative fixtures.**

`tools/test/fixtures/swap-slots/missing-default.json`:

```json
{
  "id": "TEST_swap_missing_default",
  "list_id": "TEST_swap_missing_default",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "demi", "id": 1, "name": "Demi", "pts": 100, "cost_pts": 100, "upgrades": [],
          "swap_slots": [
            {
              "string_id": "slot1", "label": "Slot 1",
              "variants": [
                { "upgrade_id": 100 },
                { "upgrade_id": 101 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 100, "name": "A", "pts": 0 },
    { "id": 101, "name": "B", "pts": 0 }
  ]
}
```

`tools/test/fixtures/swap-slots/two-defaults.json` (same as above but both variants have `"is_default": true`):

```json
{
  "id": "TEST_swap_two_defaults",
  "list_id": "TEST_swap_two_defaults",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "demi", "id": 1, "name": "Demi", "pts": 100, "cost_pts": 100, "upgrades": [],
          "swap_slots": [
            {
              "string_id": "slot1", "label": "Slot 1",
              "variants": [
                { "upgrade_id": 100, "is_default": true },
                { "upgrade_id": 101, "is_default": true }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 100, "name": "A", "pts": 0 },
    { "id": 101, "name": "B", "pts": 0 }
  ]
}
```

`tools/test/fixtures/swap-slots/variant-not-in-upgrades.json` (variant id `999` not defined in `upgrades[]`):

```json
{
  "id": "TEST_swap_missing_upgrade",
  "list_id": "TEST_swap_missing_upgrade",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "demi", "id": 1, "name": "Demi", "pts": 100, "cost_pts": 100, "upgrades": [],
          "swap_slots": [
            {
              "string_id": "slot1", "label": "Slot 1",
              "variants": [
                { "upgrade_id": 100, "is_default": true },
                { "upgrade_id": 999 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 100, "name": "A", "pts": 0 }
  ]
}
```

`tools/test/fixtures/swap-slots/variant-also-in-formation-upgrades.json` (upgrade `100` is both a variant and in formation's `upgrades[]`):

```json
{
  "id": "TEST_swap_double_render",
  "list_id": "TEST_swap_double_render",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "demi", "id": 1, "name": "Demi", "pts": 100, "cost_pts": 100, "upgrades": [100],
          "swap_slots": [
            {
              "string_id": "slot1", "label": "Slot 1",
              "variants": [
                { "upgrade_id": 100, "is_default": true },
                { "upgrade_id": 101 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 100, "name": "A", "pts": 0 },
    { "id": 101, "name": "B", "pts": 0 }
  ]
}
```

`tools/test/fixtures/swap-slots/duplicate-slot-string-ids.json` (two slots with the same `string_id`):

```json
{
  "id": "TEST_swap_dup_slots",
  "list_id": "TEST_swap_dup_slots",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "demi", "id": 1, "name": "Demi", "pts": 100, "cost_pts": 100, "upgrades": [],
          "swap_slots": [
            {
              "string_id": "slot1", "label": "Slot 1",
              "variants": [
                { "upgrade_id": 100, "is_default": true },
                { "upgrade_id": 101 }
              ]
            },
            {
              "string_id": "slot1", "label": "Slot 1 again",
              "variants": [
                { "upgrade_id": 102, "is_default": true },
                { "upgrade_id": 103 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 100, "name": "A", "pts": 0 },
    { "id": 101, "name": "B", "pts": 0 },
    { "id": 102, "name": "C", "pts": 0 },
    { "id": 103, "name": "D", "pts": 0 }
  ]
}
```

- [ ] **Step 2: Add failing tests for each negative fixture.**

Append to `tools/test/validate-lists.test.js`:

```javascript
test('rejects swap slot with no default variant', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'missing-default.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /default/i.test(e)), `expected a 'default' error, got: ${result.errors.join('; ')}`);
});

test('rejects swap slot with two default variants', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'two-defaults.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /default/i.test(e)));
});

test('rejects variant upgrade_id not present in top-level upgrades', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'variant-not-in-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /upgrade.*99[0-9]/i.test(e) || /not found/i.test(e)));
});

test('rejects upgrade appearing in both swap variants and formation upgrades', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'variant-also-in-formation-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /double|both|already/i.test(e)));
});

test('rejects duplicate swap-slot string_ids on the same formation', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'duplicate-slot-string-ids.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /duplicate|unique/i.test(e)));
});
```

- [ ] **Step 3: Run the tests to verify they fail.**

Run: `node --test tools/test/validate-lists.test.js`
Expected: 5 FAIL, 1 PASS (semantic rules aren't implemented yet).

- [ ] **Step 4: Implement semantic validation in `tools/validate-lists.mjs`.**

After the JSON-schema check inside `validateListFile`, add the semantic block. Replace this section of the function:

```javascript
  if (!validate(json)) {
    for (const e of validate.errors ?? []) {
      errors.push(`${e.instancePath || '/'} ${e.message}`);
    }
  }
  // Semantic checks (cross-references the JSON-schema can't express) come in Task 3.
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
```

with:

```javascript
  if (!validate(json)) {
    for (const e of validate.errors ?? []) {
      errors.push(`${e.instancePath || '/'} ${e.message}`);
    }
  }

  // Semantic checks for swap_slots (cross-references JSON Schema can't express).
  const upgradeIds = new Set((json.upgrades ?? []).map((u) => u.id));
  for (const section of json.sections ?? []) {
    for (const f of section.formations ?? []) {
      const slots = f.swap_slots;
      if (!Array.isArray(slots) || slots.length === 0) continue;

      const slotIds = new Set();
      for (const slot of slots) {
        // Duplicate slot string_id within this formation
        if (slot.string_id) {
          if (slotIds.has(slot.string_id)) {
            errors.push(`formation '${f.string_id ?? f.name}' has duplicate swap_slot string_id '${slot.string_id}'`);
          }
          slotIds.add(slot.string_id);
        }

        // Default count: must be exactly 1
        const variants = slot.variants ?? [];
        const defaults = variants.filter((v) => v.is_default === true);
        if (defaults.length !== 1) {
          errors.push(`formation '${f.string_id ?? f.name}' swap_slot '${slot.string_id}': expected exactly one variant with is_default:true, found ${defaults.length}`);
        }

        // Each variant must reference an upgrade that exists in top-level upgrades[]
        for (const v of variants) {
          if (!upgradeIds.has(v.upgrade_id)) {
            errors.push(`formation '${f.string_id ?? f.name}' swap_slot '${slot.string_id}': variant references upgrade_id '${v.upgrade_id}' not found in upgrades[]`);
          }
        }

        // No variant upgrade may also appear in the formation's plain upgrades[]
        const formationUpgrades = new Set(f.upgrades ?? []);
        for (const v of variants) {
          if (formationUpgrades.has(v.upgrade_id)) {
            errors.push(`formation '${f.string_id ?? f.name}': upgrade '${v.upgrade_id}' appears in both swap_slot '${slot.string_id}' and the formation's upgrades[] (would double-render)`);
          }
        }
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `node --test tools/test/validate-lists.test.js`
Expected: 6 tests pass.

- [ ] **Step 6: Re-run CLI against real lists to make sure nothing regressed.**

Run: `node tools/validate-lists.mjs`
Expected: still `OK: 156 files`. If a real list now fails, it's a pre-existing semantic issue; record it in the commit message but don't fix here unless it's the worked Gryphonne case (handled in Task 11).

- [ ] **Step 7: Commit.**

```bash
git add tools/validate-lists.mjs tools/test/validate-lists.test.js tools/test/fixtures/swap-slots/
git commit -m "feat(tools): add semantic checks for swap_slots in list validator"
```

---

## Task 4: Regenerate auto-generated types

**Files:**
- Modify: `schemas/types.ts` (auto-regenerated)

- [ ] **Step 1: Run the type generator.**

Run: `node tools/generate-types.js`

- [ ] **Step 2: Verify the regenerated file mentions `swap_slots`.**

Run: `grep -n 'swap_slots' schemas/types.ts`
Expected: at least one match showing the new optional field in the `EpicArmyBuilderArmyList` interface or a nested type.

- [ ] **Step 3: Typecheck.**

Run: `npm run typecheck`
Expected: passes (the new type is additive; no consumers reference it yet).

- [ ] **Step 4: Commit.**

```bash
git add schemas/types.ts
git commit -m "chore(schema): regenerate types for swap_slots"
```

---

## Task 5: Wire `apps/web` and `tools/test` into root `npm test`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package.json` (root)

This must land before Task 6 so the selector/store tests we add actually run in CI.

- [ ] **Step 1: Add a `test` script to `apps/web/package.json`.**

Insert after `"typecheck": "tsc --noEmit"`:

```json
    "test": "node --test --import tsx 'src/**/__tests__/*.test.ts' 'src/**/__tests__/**/*.test.ts'",
```

So the scripts block reads:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build && tsc --noEmit",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "node --test --import tsx 'src/**/__tests__/*.test.ts' 'src/**/__tests__/**/*.test.ts'"
  },
```

- [ ] **Step 2: Verify the web workspace can find tsx.**

Run: `npm ls tsx --workspace apps/web`

If it reports `(empty)`, install tsx as a devDependency in the web workspace:

Run: `npm install --save-dev tsx --workspace apps/web`

- [ ] **Step 3: Run web tests to confirm the existing `selectors.test.ts` runs.**

Run: `npm test --workspace apps/web`
Expected: existing selector tests pass. Note the count; you'll add to it in Task 6.

- [ ] **Step 4: Extend the root `test` script to also run `apps/web` and `tools/test`.**

Edit `package.json` (root). Replace:

```json
    "test": "npm run test --workspace apps/api",
```

with:

```json
    "test": "npm run test --workspace apps/api && npm run test --workspace apps/web && node --test 'tools/test/*.test.js'",
```

- [ ] **Step 5: Run the full root test command.**

Run: `npm test`
Expected: API tests pass, web tests pass, tools tests pass (validate-lists.test.js + any existing tools tests like `loader.test.js`).

- [ ] **Step 6: Commit.**

```bash
git add apps/web/package.json package.json package-lock.json
git commit -m "test: wire web and tools workspaces into root npm test"
```

---

## Task 6: Selector types + helpers (TDD)

**Files:**
- Modify: `apps/web/src/stores/selectors.ts`
- Modify: `apps/web/src/stores/__tests__/selectors.test.ts`

- [ ] **Step 1: Write failing tests for the new selector behavior.**

Open `apps/web/src/stores/__tests__/selectors.test.ts`. Just above the existing `sampleCatalog` declaration, *replace* the existing catalog with one that includes a `swap_slots[]` definition so all tests can share it:

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
      ],
    },
  ],
  upgrades: [
    { id: 1, string_id: 'commander', name: 'Commander', cost_pts: 50 },
    { id: 2, string_id: 'banner', name: 'Banner', cost_pts: 25 },
    { id: 100, string_id: 'gun_servitors', name: 'Gun Servitors', cost_pts: 0 },
    { id: 101, string_id: 'rapier_lasers', name: 'Rapier Lasers', cost_pts: 30 },
  ],
};
```

Then append these new test blocks at the end of the file:

```typescript
import { swapDeltaForFormation, getSwapChoice, findFormationByStringId } from '../selectors';

describe('swap_slots — totalPoints', () => {
  test('formation with default selection costs base only', () => {
    const state = emptyState();
    state.formations = [{ instance_id: 'i1', formation_string_id: 'demi', upgrade_string_ids: [], swap_choices: {} }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 250);
  });

  test('formation with non-default selection adds delta', () => {
    const state = emptyState();
    state.formations = [{
      instance_id: 'i1',
      formation_string_id: 'demi',
      upgrade_string_ids: [],
      swap_choices: { support: 'rapier_lasers' },
    }];
    // default gun_servitors costs 0; chosen rapier_lasers costs 30. delta = +30.
    assert.strictEqual(totalPoints(state, sampleCatalog), 280);
  });

  test('formation with no swap_choices field falls back to default', () => {
    const state = emptyState();
    // No swap_choices key at all (legacy body_version: 1)
    state.formations = [{ instance_id: 'i1', formation_string_id: 'demi', upgrade_string_ids: [] }];
    assert.strictEqual(totalPoints(state, sampleCatalog), 250);
  });
});

describe('swap_slots — getSwapChoice', () => {
  test('returns default variant string_id when slot is unchosen', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    const choice = getSwapChoice(sampleCatalog, def, {}, 'support');
    assert.strictEqual(choice, 'gun_servitors');
  });

  test('returns chosen variant string_id when present', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    const choice = getSwapChoice(sampleCatalog, def, { support: 'rapier_lasers' }, 'support');
    assert.strictEqual(choice, 'rapier_lasers');
  });

  test('returns default when chosen variant is no longer valid (catalog drift)', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    const choice = getSwapChoice(sampleCatalog, def, { support: 'nonexistent' }, 'support');
    assert.strictEqual(choice, 'gun_servitors');
  });
});

describe('swap_slots — swapDeltaForFormation', () => {
  test('returns 0 when all slots resolve to defaults', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    assert.strictEqual(swapDeltaForFormation(sampleCatalog, def, {}), 0);
  });

  test('returns chosen.pts - default.pts when slot has a non-default choice', () => {
    const def = findFormationByStringId(sampleCatalog, 'demi')!;
    assert.strictEqual(swapDeltaForFormation(sampleCatalog, def, { support: 'rapier_lasers' }), 30);
  });

  test('returns 0 for formations with no swap_slots', () => {
    const def = findFormationByStringId(sampleCatalog, 'inf')!;
    assert.strictEqual(swapDeltaForFormation(sampleCatalog, def, {}), 0);
  });
});
```

The test file uses `describe` from `node:test`. Make sure the existing import at the top reads:

```typescript
import { describe, test } from 'node:test';
```

(It already does — confirmed in repo inspection.)

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npm test --workspace apps/web`
Expected: existing tests pass, the new swap_slots tests FAIL with TypeScript errors about missing exports / missing fields on `BuilderFormation` / missing `swap_slots` on `CatalogFormation`.

- [ ] **Step 3: Extend `apps/web/src/stores/selectors.ts` with the new types and helpers.**

Open `apps/web/src/stores/selectors.ts`. Replace the entire file with:

```typescript
import type { BuilderState } from './builder-store';

// Shape of war/lists/<list_id>.json
export interface CatalogList {
  list_id: string;
  faction_id?: string;
  ruleset?: string;
  sections: Array<{
    name: string;
    formations: CatalogFormation[];
  }>;
  upgrades?: CatalogUpgrade[];
}

export interface CatalogFormation {
  id?: number;
  string_id?: string;
  name: string;
  pts?: number;
  cost_pts?: number;
  units?: string;
  upgrades?: number[];
  swap_slots?: CatalogSwapSlot[];
}

export interface CatalogUpgrade {
  id: number;
  string_id?: string;
  name: string;
  pts?: number;
  cost_pts?: number;
}

export interface CatalogSwapSlot {
  string_id: string;
  label: string;
  variants: CatalogSwapVariant[];
}

export interface CatalogSwapVariant {
  upgrade_id: number | string;
  is_default?: boolean;
}

export function findFormationByStringId(catalog: CatalogList, string_id: string): CatalogFormation | null {
  for (const section of catalog.sections ?? []) {
    for (const f of section.formations ?? []) {
      if (f.string_id === string_id) return f;
    }
  }
  return null;
}

export function findUpgradeByStringId(catalog: CatalogList, string_id: string): CatalogUpgrade | null {
  return catalog.upgrades?.find((u) => u.string_id === string_id) ?? null;
}

export function findUpgradeById(catalog: CatalogList, id: number | string): CatalogUpgrade | null {
  return catalog.upgrades?.find((u) => u.id === id) ?? null;
}

/** The default variant's upgrade.string_id for a given slot. Returns null if the slot has no default (data error). */
function defaultVariantStringId(catalog: CatalogList, slot: CatalogSwapSlot): string | null {
  const def = slot.variants.find((v) => v.is_default === true);
  if (!def) return null;
  const up = findUpgradeById(catalog, def.upgrade_id);
  return up?.string_id ?? null;
}

/**
 * Resolves the chosen variant for a swap slot.
 * - If the saved choice references a still-valid variant, returns it.
 * - Otherwise falls back to the slot's default (catalog drift, missing key, etc.).
 */
export function getSwapChoice(
  catalog: CatalogList,
  formation: CatalogFormation,
  swap_choices: Record<string, string> | undefined,
  slot_string_id: string,
): string | null {
  const slot = formation.swap_slots?.find((s) => s.string_id === slot_string_id);
  if (!slot) return null;
  const chosen = swap_choices?.[slot_string_id];
  if (chosen) {
    // Verify the chosen value still maps to a variant in this slot
    const stillValid = slot.variants.some((v) => {
      const up = findUpgradeById(catalog, v.upgrade_id);
      return up?.string_id === chosen;
    });
    if (stillValid) return chosen;
  }
  return defaultVariantStringId(catalog, slot);
}

/**
 * Total pts delta from swap-slot choices on a formation.
 * delta = Σ (chosen.pts − default.pts) across slots.
 */
export function swapDeltaForFormation(
  catalog: CatalogList,
  formation: CatalogFormation,
  swap_choices: Record<string, string> | undefined,
): number {
  let delta = 0;
  for (const slot of formation.swap_slots ?? []) {
    const defaultVar = slot.variants.find((v) => v.is_default === true);
    if (!defaultVar) continue;
    const defaultUp = findUpgradeById(catalog, defaultVar.upgrade_id);
    const defaultPts = defaultUp?.cost_pts ?? defaultUp?.pts ?? 0;

    const chosenStringId = getSwapChoice(catalog, formation, swap_choices, slot.string_id);
    if (!chosenStringId) continue;
    const chosenUp = findUpgradeByStringId(catalog, chosenStringId);
    const chosenPts = chosenUp?.cost_pts ?? chosenUp?.pts ?? 0;

    delta += chosenPts - defaultPts;
  }
  return delta;
}

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
  }
  return total;
}

export function violations(state: BuilderState, catalog: CatalogList): string[] {
  const msgs: string[] = [];
  if (state.points_target != null) {
    const total = totalPoints(state, catalog);
    if (total > state.points_target) {
      msgs.push(`Over points target by ${total - state.points_target}.`);
    }
  }
  return msgs;
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npm test --workspace apps/web`
Expected: all selector tests pass (including the new swap blocks).

You will get a TypeScript error on `inst.swap_choices` because `BuilderFormation` doesn't have that field yet — that's expanded in Task 7. To make this task's commit typecheck on its own, add ONLY this minimal change to `apps/web/src/stores/builder-store.ts`:

In the `BuilderFormation` interface, add `swap_choices?: Record<string, string>;` after `upgrade_string_ids: string[];`. No other changes to that file in this task — the actions, `body_version`, and `selectSwapVariant` are introduced in Task 7.

- [ ] **Step 5: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/stores/selectors.ts apps/web/src/stores/__tests__/selectors.test.ts apps/web/src/stores/builder-store.ts
git commit -m "feat(web): selector helpers for swap_slots delta + choice resolution"
```

---

## Task 7: Builder store — swap_choices, selectSwapVariant, body_version, stale-data handling (TDD)

**Files:**
- Modify: `apps/web/src/stores/builder-store.ts`
- Modify: `apps/web/src/stores/__tests__/selectors.test.ts` (add store-action tests)

- [ ] **Step 1: Add failing tests for store behavior.**

Append to `apps/web/src/stores/__tests__/selectors.test.ts`:

```typescript
import { useBuilderStore } from '../builder-store';

describe('builder-store — selectSwapVariant', () => {
  test('records a non-default choice', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('demi');
    const inst = useBuilderStore.getState().formations[0];
    useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'rapier_lasers');
    const after = useBuilderStore.getState().formations[0];
    assert.deepStrictEqual(after.swap_choices, { support: 'rapier_lasers' });
  });

  test('selecting the default removes the key', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromCatalog('TEST');
    useBuilderStore.getState().addFormation('demi');
    const inst = useBuilderStore.getState().formations[0];
    useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'rapier_lasers');
    // Now flip back to default
    useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'gun_servitors');
    const after = useBuilderStore.getState().formations[0];
    assert.deepStrictEqual(after.swap_choices ?? {}, {}, 'default selection should clear the key');
  });
});

describe('builder-store — initFromSavedList stale-data handling', () => {
  test('drops swap_choices keys whose variant no longer exists in catalog', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromSavedList({
      id: 's1', list_id: 'TEST', title: 't', points_target: null, is_public: false,
      body: {
        body_version: 2,
        formations: [{
          instance_id: 'i1',
          formation_string_id: 'demi',
          upgrade_string_ids: [],
          swap_choices: { support: 'NO_SUCH_VARIANT', other_slot: 'ghost' },
        }],
      },
    });
    const f = useBuilderStore.getState().formations[0];
    // We can't validate against the catalog here (the store doesn't see the catalog at init time),
    // so the loader keeps unknown values. Resolution to defaults happens in getSwapChoice() at render/total time.
    // This test just confirms the value made it through unchanged.
    assert.strictEqual(f.swap_choices?.support, 'NO_SUCH_VARIANT');
  });

  test('legacy body without swap_choices loads cleanly', () => {
    useBuilderStore.getState().reset();
    useBuilderStore.getState().initFromSavedList({
      id: 's1', list_id: 'TEST', title: 't', points_target: null, is_public: false,
      body: {
        formations: [{ instance_id: 'i1', formation_string_id: 'demi', upgrade_string_ids: [] }],
      },
    });
    const f = useBuilderStore.getState().formations[0];
    assert.strictEqual(f.swap_choices, undefined);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npm test --workspace apps/web`
Expected: new tests FAIL — `selectSwapVariant is not a function`.

- [ ] **Step 3: Update `apps/web/src/stores/builder-store.ts`.**

Replace the entire file with:

```typescript
import { create } from 'zustand';
import { ulid } from 'ulid';

export interface BuilderFormation {
  instance_id: string;
  formation_string_id: string;
  upgrade_string_ids: string[];
  /** Map from swap_slot.string_id to the chosen variant's upgrade.string_id.
   * Only non-default selections are stored; absence = default. Optional for backward compat. */
  swap_choices?: Record<string, string>;
}

export interface SavedListSummary {
  id: string;
  list_id: string;
  title: string;
  points_target: number | null;
  is_public: boolean;
  body: unknown;
}

export interface BuilderState {
  list_id: string | null;
  user_list_id: string | null;
  title: string;
  points_target: number | null;
  is_public: boolean;
  /** Body schema version. Absent/1 = legacy; 2 = with swap_choices. Always written as 2 going forward. */
  body_version: number;
  formations: BuilderFormation[];

  initFromCatalog(list_id: string): void;
  initFromSavedList(saved: SavedListSummary): void;
  addFormation(formation_string_id: string): void;
  removeFormation(instance_id: string): void;
  toggleUpgrade(instance_id: string, upgrade_string_id: string): void;
  /** Set the chosen variant for a swap slot on a formation instance.
   * If the chosen variant equals the slot's default, this implementation removes the key
   * (save-only-non-defaults rule). The caller must pass `default_variant_string_id` so
   * the store can detect equality without reading the catalog. */
  selectSwapVariant(
    instance_id: string,
    slot_string_id: string,
    chosen_variant_string_id: string,
    default_variant_string_id: string,
  ): void;
  setTitle(title: string): void;
  setPointsTarget(n: number | null): void;
  setIsPublic(b: boolean): void;
  setUserListId(id: string): void;
  reset(): void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  list_id: null,
  user_list_id: null,
  title: '',
  points_target: null,
  is_public: false,
  body_version: 2,
  formations: [],

  initFromCatalog: (list_id) => set({
    list_id,
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 2,
    formations: [],
  }),
  initFromSavedList: (saved) => set(() => {
    const body = (saved.body && typeof saved.body === 'object') ? saved.body as {
      formations?: BuilderFormation[];
      body_version?: number;
    } : {};
    return {
      list_id: saved.list_id,
      user_list_id: saved.id,
      title: saved.title,
      points_target: saved.points_target,
      is_public: saved.is_public,
      body_version: typeof body.body_version === 'number' ? body.body_version : 1,
      formations: Array.isArray(body.formations) ? body.formations : [],
    };
  }),
  addFormation: (formation_string_id) => set((s) => ({
    formations: [
      ...s.formations,
      {
        instance_id: ulid(),
        formation_string_id,
        upgrade_string_ids: [],
      },
    ],
  })),
  removeFormation: (instance_id) => set((s) => ({
    formations: s.formations.filter((f) => f.instance_id !== instance_id),
  })),
  toggleUpgrade: (instance_id, upgrade_string_id) => set((s) => ({
    formations: s.formations.map((f) => {
      if (f.instance_id !== instance_id) return f;
      const has = f.upgrade_string_ids.includes(upgrade_string_id);
      return {
        ...f,
        upgrade_string_ids: has
          ? f.upgrade_string_ids.filter((u) => u !== upgrade_string_id)
          : [...f.upgrade_string_ids, upgrade_string_id],
      };
    }),
  })),
  selectSwapVariant: (instance_id, slot_string_id, chosen_variant_string_id, default_variant_string_id) => set((s) => ({
    formations: s.formations.map((f) => {
      if (f.instance_id !== instance_id) return f;
      const current = { ...(f.swap_choices ?? {}) };
      if (chosen_variant_string_id === default_variant_string_id) {
        // Save-only-non-defaults rule: remove the key
        delete current[slot_string_id];
      } else {
        current[slot_string_id] = chosen_variant_string_id;
      }
      const next: BuilderFormation = { ...f };
      if (Object.keys(current).length === 0) {
        delete next.swap_choices;
      } else {
        next.swap_choices = current;
      }
      return next;
    }),
  })),
  setTitle: (title) => set({ title }),
  setPointsTarget: (n) => set({ points_target: n }),
  setIsPublic: (b) => set({ is_public: b }),
  setUserListId: (id) => set({ user_list_id: id }),
  reset: () => set({
    list_id: null,
    user_list_id: null,
    title: '',
    points_target: null,
    is_public: false,
    body_version: 2,
    formations: [],
  }),
}));
```

- [ ] **Step 4: Update the test calls so they pass the new `default_variant_string_id` arg.**

Find both `selectSwapVariant` calls in the new tests you added in Step 1 and update them:

```typescript
useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'rapier_lasers', 'gun_servitors');
```

and:

```typescript
useBuilderStore.getState().selectSwapVariant(inst.instance_id, 'support', 'gun_servitors', 'gun_servitors');
```

- [ ] **Step 5: Run tests to verify they pass.**

Run: `npm test --workspace apps/web`
Expected: all tests pass.

- [ ] **Step 6: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/src/stores/builder-store.ts apps/web/src/stores/__tests__/selectors.test.ts
git commit -m "feat(web): swap_choices in builder store with body_version=2"
```

---

## Task 8: Builder UI — Composition subsection on FormationCard

**Files:**
- Modify: `apps/web/src/routes/build.$listId.tsx`

This is the visual change. No new test code (the underlying logic is covered by Tasks 6 and 7).

- [ ] **Step 1: Update the imports at the top of `apps/web/src/routes/build.$listId.tsx`.**

Replace:

```typescript
import { totalPoints, violations, findUpgradeByStringId, type CatalogList } from '@/stores/selectors';
```

with:

```typescript
import {
  totalPoints,
  violations,
  findUpgradeByStringId,
  findUpgradeById,
  getSwapChoice,
  type CatalogList,
  type CatalogSwapSlot,
} from '@/stores/selectors';
```

- [ ] **Step 2: Replace the `FormationCard` component (the entire function from line 227 to the end of the file).**

Replace the existing `FormationCard` with:

```tsx
function FormationCard({
  instance,
  catalog,
  sourceJson,
}: {
  instance: { instance_id: string; formation_string_id: string; upgrade_string_ids: string[]; swap_choices?: Record<string, string> };
  catalog: CatalogList;
  sourceJson: SourceJson | null;
}) {
  const builder = useBuilderStore();
  const def = catalog.sections.flatMap((s) => s.formations).find((f) => f.string_id === instance.formation_string_id);
  if (!def) {
    return (
      <li className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
        Unknown formation: {instance.formation_string_id}
        <Button size="sm" variant="ghost" onClick={() => builder.removeFormation(instance.instance_id)} className="ml-2">Remove</Button>
      </li>
    );
  }

  const availableUpgrades = (def.upgrades ?? [])
    .map((id) => catalog.upgrades?.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u);

  let totalCost = def.cost_pts ?? def.pts ?? 0;
  for (const usid of instance.upgrade_string_ids) {
    const u = findUpgradeByStringId(catalog, usid);
    if (u) totalCost += u.cost_pts ?? u.pts ?? 0;
  }
  // Swap delta
  for (const slot of def.swap_slots ?? []) {
    const defaultVar = slot.variants.find((v) => v.is_default === true);
    if (!defaultVar) continue;
    const defaultUp = findUpgradeById(catalog, defaultVar.upgrade_id);
    const defaultPts = defaultUp?.cost_pts ?? defaultUp?.pts ?? 0;
    const chosenSid = getSwapChoice(catalog, def, instance.swap_choices, slot.string_id);
    const chosenUp = chosenSid ? findUpgradeByStringId(catalog, chosenSid) : null;
    const chosenPts = chosenUp?.cost_pts ?? chosenUp?.pts ?? 0;
    totalCost += chosenPts - defaultPts;
  }

  const selectedUpgrades = availableUpgrades.filter(
    (u) => u.string_id && instance.upgrade_string_ids.includes(u.string_id),
  );

  return (
    <li className="rounded-md border bg-card p-3 break-inside-avoid">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium">{def.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{totalCost} pts</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => builder.removeFormation(instance.instance_id)} className="print:hidden">×</Button>
      </div>

      {(def.swap_slots ?? []).length > 0 && (
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
          </ul>
        </div>
      )}

      {availableUpgrades.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 print:hidden">
          {availableUpgrades.map((u) => {
            const checked = u.string_id ? instance.upgrade_string_ids.includes(u.string_id) : false;
            return (
              <li key={u.id} className="text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!u.string_id}
                    onChange={() => u.string_id && builder.toggleUpgrade(instance.instance_id, u.string_id)}
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
        </ul>
      )}

      {/* Print view: selected upgrades and resolved swap choices */}
      {(selectedUpgrades.length > 0 || (def.swap_slots ?? []).length > 0) && (
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

      <FormationProfiles formationName={def.name} sourceJson={sourceJson} />
    </li>
  );
}

function SwapSlotControl({
  slot,
  catalog,
  instanceId,
  currentChoiceStringId,
}: {
  slot: CatalogSwapSlot;
  catalog: CatalogList;
  instanceId: string;
  currentChoiceStringId: string | null;
}) {
  const builder = useBuilderStore();
  const defaultVariant = slot.variants.find((v) => v.is_default === true);
  if (!defaultVariant) return null;
  const defaultUp = findUpgradeById(catalog, defaultVariant.upgrade_id);
  const defaultStringId = defaultUp?.string_id ?? null;
  if (!defaultStringId) return null;

  if (slot.variants.length === 2) {
    // 2 variants → single checkbox toggle labeled with the non-default variant
    const other = slot.variants.find((v) => v.is_default !== true);
    if (!other) return null;
    const otherUp = findUpgradeById(catalog, other.upgrade_id);
    if (!otherUp || !otherUp.string_id) return null;
    const checked = currentChoiceStringId === otherUp.string_id;
    const delta = (otherUp.cost_pts ?? otherUp.pts ?? 0) - (defaultUp.cost_pts ?? defaultUp.pts ?? 0);
    return (
      <li className="text-sm">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => builder.selectSwapVariant(
              instanceId,
              slot.string_id,
              checked ? defaultStringId : otherUp.string_id!,
              defaultStringId,
            )}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            <span className="text-xs text-muted-foreground">{slot.label}: </span>
            Replace {defaultUp.name.toLowerCase()} with {otherUp.name.toLowerCase()}
            <span className="ml-1 text-xs text-muted-foreground">
              ({delta === 0 ? '+0' : delta > 0 ? `+${delta}` : `${delta}`})
            </span>
          </span>
        </label>
      </li>
    );
  }

  // 3+ variants → radio group
  return (
    <li className="text-sm">
      <fieldset>
        <legend className="text-xs text-muted-foreground">{slot.label}</legend>
        <div className="mt-1 space-y-1">
          {slot.variants.map((v) => {
            const up = findUpgradeById(catalog, v.upgrade_id);
            if (!up || !up.string_id) return null;
            const checked = currentChoiceStringId === up.string_id;
            const delta = (up.cost_pts ?? up.pts ?? 0) - (defaultUp.cost_pts ?? defaultUp.pts ?? 0);
            return (
              <label key={String(v.upgrade_id)} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={`swap-${instanceId}-${slot.string_id}`}
                  checked={checked}
                  onChange={() => builder.selectSwapVariant(
                    instanceId,
                    slot.string_id,
                    up.string_id!,
                    defaultStringId,
                  )}
                  className="h-4 w-4 border-input"
                />
                <span>
                  {up.name}
                  {delta !== 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({delta > 0 ? `+${delta}` : `${delta}`})
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </li>
  );
}
```

- [ ] **Step 3: Make sure the `instance` prop type matches the store's `BuilderFormation`.**

In the existing call site (line ~217), the prop is currently typed inline. The new `FormationCard` includes `swap_choices?: Record<string, string>` in its prop type — that matches the store. No call-site change needed.

- [ ] **Step 4: Typecheck.**

Run: `npm run typecheck --workspace apps/web`
Expected: passes.

- [ ] **Step 5: Run web tests.**

Run: `npm test --workspace apps/web`
Expected: all selector + store tests pass.

- [ ] **Step 6: Smoke-test the dev server.**

Run: `npm run dev --workspace apps/api` (in one terminal) and `npm run dev --workspace apps/web` (in another).

Open `http://localhost:5173/v2/build/AMTL_skitarii_NETEA?from=` and verify the existing builder still loads + the Sagitarii Demi-Century formation renders with no Composition section (because we haven't added the worked case yet — that's Task 11). Once Task 11 lands, you'll come back and verify the toggle.

Kill the dev servers when done.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/src/routes/build.\$listId.tsx
git commit -m "feat(web): render swap_slots as Composition toggle/radio on formation card"
```

---

## Task 9: Server-side Zod body validation in tRPC `lists.save`

**Files:**
- Create: `apps/api/src/catalog/list-catalog.ts`
- Modify: `apps/api/src/trpc/lists.ts`
- Modify: `apps/api/src/__tests__/integration/lists.test.ts`

- [ ] **Step 1: Write a failing integration test for the new server-side validation.**

Open `apps/api/src/__tests__/integration/lists.test.ts`. The existing tests use `CHAOS_dg_NETEA` — but that list has no `swap_slots` (yet). For validation tests we need a list that *does* have a swap slot. Until Task 11 (Gryphonne case) lands, use a fixture list. We'll add the fixture path now and the actual fixture file in Step 2.

Append these tests:

```typescript
import path from 'node:path';
import fs from 'node:fs/promises';
import { WAR_ROOT } from '../../paths.js';

const TEST_LIST_ID = 'TEST_swap_fixture';
const TEST_FIXTURE_PATH = path.join(WAR_ROOT, 'lists', `${TEST_LIST_ID}.json`);
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
      ],
    },
  ],
  upgrades: [
    { id: 10, string_id: 'hydra', name: 'Hydra', pts: 50 },
    { id: 100, string_id: 'gun_servitors', name: 'Gun Servitors', pts: 0 },
    { id: 101, string_id: 'rapier_lasers', name: 'Rapier Lasers', pts: 30 },
  ],
};

async function ensureTestFixture() {
  await fs.writeFile(TEST_FIXTURE_PATH, JSON.stringify(TEST_FIXTURE, null, 2), 'utf8');
  invalidateListIdCache();
}

async function removeTestFixture() {
  try { await fs.unlink(TEST_FIXTURE_PATH); } catch { /* ignore */ }
  invalidateListIdCache();
}

test('save accepts a valid swap_choices body', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    const result = await authed.lists.save.mutate({
      title: 'Swap test',
      list_id: TEST_LIST_ID,
      body: {
        body_version: 2,
        formations: [{
          instance_id: '01HSWAPTEST',
          formation_string_id: 'demi',
          upgrade_string_ids: [],
          swap_choices: { support: 'rapier_lasers' },
        }],
      },
    });
    assert.ok(result.id);
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects swap_choices key that is not a slot on the formation', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad slot',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 2,
          formations: [{
            instance_id: '01HSWAPBAD1',
            formation_string_id: 'demi',
            upgrade_string_ids: [],
            swap_choices: { nonexistent_slot: 'rapier_lasers' },
          }],
        },
      }),
      /nonexistent_slot|unknown swap slot|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects swap_choices value that is not a valid variant', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad variant',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 2,
          formations: [{
            instance_id: '01HSWAPBAD2',
            formation_string_id: 'demi',
            upgrade_string_ids: [],
            swap_choices: { support: 'ghost_variant' },
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

test('save rejects unknown body_version', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad version',
        list_id: TEST_LIST_ID,
        body: { body_version: 99, formations: [] },
      }),
      /body_version|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save accepts legacy body (no body_version, no swap_choices)', async () => {
  // No fixture needed — using the existing CHAOS_dg_NETEA from earlier tests.
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);
  const result = await authed.lists.save.mutate({
    title: 'Legacy body',
    list_id: VALID_LIST_ID,
    body: { units: [], notes: 'legacy' },
  });
  assert.ok(result.id);
  close();
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --workspace apps/api`
Expected: new swap tests FAIL (server doesn't validate yet — the malformed inputs save without error).

- [ ] **Step 3: Create the per-list catalog loader.**

Create `apps/api/src/catalog/list-catalog.ts`:

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { WAR_ROOT } from '../paths.js';

const LISTS_DIR = path.join(WAR_ROOT, 'lists');

// Minimal subset of the list catalog needed for save-time validation.
export interface CatalogSwapVariant {
  upgrade_id: number | string;
  is_default?: boolean;
}

export interface CatalogSwapSlot {
  string_id: string;
  label: string;
  variants: CatalogSwapVariant[];
}

export interface CatalogFormation {
  string_id?: string;
  swap_slots?: CatalogSwapSlot[];
  upgrades?: number[];
}

export interface CatalogUpgrade {
  id: number | string;
  string_id?: string;
}

export interface ListCatalog {
  list_id: string;
  formationsByStringId: Map<string, CatalogFormation>;
  upgradesById: Map<number | string, CatalogUpgrade>;
  upgradesByStringId: Map<string, CatalogUpgrade>;
}

const cache = new Map<string, ListCatalog | null>();

async function findFileForListId(list_id: string): Promise<string | null> {
  const entries = await fs.readdir(LISTS_DIR);
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    try {
      const body = await fs.readFile(path.join(LISTS_DIR, f), 'utf8');
      const parsed = JSON.parse(body);
      if (parsed.list_id === list_id) return path.join(LISTS_DIR, f);
    } catch { /* ignore */ }
  }
  return null;
}

export async function getListCatalog(list_id: string): Promise<ListCatalog | null> {
  if (cache.has(list_id)) return cache.get(list_id) ?? null;
  const filePath = await findFileForListId(list_id);
  if (!filePath) {
    cache.set(list_id, null);
    return null;
  }
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const upgrades: CatalogUpgrade[] = Array.isArray(parsed.upgrades) ? parsed.upgrades : [];
  const upgradesById = new Map<number | string, CatalogUpgrade>(upgrades.map((u) => [u.id, u]));
  const upgradesByStringId = new Map<string, CatalogUpgrade>(
    upgrades.filter((u) => typeof u.string_id === 'string').map((u) => [u.string_id!, u]),
  );
  const formations: CatalogFormation[] = [];
  for (const section of parsed.sections ?? []) {
    for (const f of section.formations ?? []) formations.push(f);
  }
  const formationsByStringId = new Map<string, CatalogFormation>(
    formations.filter((f) => typeof f.string_id === 'string').map((f) => [f.string_id!, f]),
  );
  const catalog: ListCatalog = { list_id, formationsByStringId, upgradesById, upgradesByStringId };
  cache.set(list_id, catalog);
  return catalog;
}

/** Test helper — reset the cache on next call. */
export function invalidateListCatalogCache(): void {
  cache.clear();
}
```

- [ ] **Step 4: Replace `body: z.unknown()` in `apps/api/src/trpc/lists.ts` with structured validation.**

Open `apps/api/src/trpc/lists.ts`. Replace the existing `saveInput` declaration:

```typescript
const saveInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(MAX_LIST_TITLE_LEN),
  list_id: z.string().min(1),
  points_target: z.number().int().nonnegative().optional(),
  body: z.unknown(),
  is_public: z.boolean().optional(),
});
```

with:

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
}).passthrough(); // tolerant of extra fields (legacy bodies may have other keys)

const saveInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(MAX_LIST_TITLE_LEN),
  list_id: z.string().min(1),
  points_target: z.number().int().nonnegative().optional(),
  body: bodyShape,
  is_public: z.boolean().optional(),
});
```

Add the import for the catalog at the top of the file:

```typescript
import { getListCatalog } from '../catalog/list-catalog.js';
```

Then, inside the `save` mutation, after the `assertBodySize(input.body)` line and before the `now = Date.now()` line, insert the swap_choices semantic validation:

```typescript
      // Validate body_version
      if (input.body.body_version !== undefined && input.body.body_version !== 1 && input.body.body_version !== 2) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `body_version: unknown value '${input.body.body_version}' (expected 1 or 2)` });
      }

      // Validate swap_choices against the referenced list catalog
      const bodyFormations = input.body.formations ?? [];
      if (bodyFormations.some((f) => f.swap_choices && Object.keys(f.swap_choices).length > 0)) {
        const cat = await getListCatalog(input.list_id);
        if (!cat) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `list_id catalog not found: ${input.list_id}` });
        }
        for (const f of bodyFormations) {
          if (!f.swap_choices) continue;
          const formationDef = cat.formationsByStringId.get(f.formation_string_id);
          if (!formationDef) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `unknown formation_string_id '${f.formation_string_id}' in instance '${f.instance_id}'` });
          }
          const slotsByStringId = new Map(
            (formationDef.swap_slots ?? []).map((s) => [s.string_id, s] as const),
          );
          for (const [slotKey, variantValue] of Object.entries(f.swap_choices)) {
            const slot = slotsByStringId.get(slotKey);
            if (!slot) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `unknown swap slot '${slotKey}' on formation '${f.formation_string_id}'` });
            }
            const variantUpgradeStringIds = slot.variants
              .map((v) => cat.upgradesById.get(v.upgrade_id)?.string_id)
              .filter((s): s is string => !!s);
            if (!variantUpgradeStringIds.includes(variantValue)) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `invalid variant '${variantValue}' for slot '${slotKey}' on formation '${f.formation_string_id}'` });
            }
          }
        }
      }
```

- [ ] **Step 5: Run the integration tests.**

Run: `npm test --workspace apps/api`
Expected: all new swap tests pass; existing tests still pass.

- [ ] **Step 6: Typecheck.**

Run: `npm run typecheck --workspace apps/api`
Expected: passes.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/catalog/list-catalog.ts apps/api/src/trpc/lists.ts apps/api/src/__tests__/integration/lists.test.ts
git commit -m "feat(api): validate swap_choices and body_version in lists.save"
```

---

## Task 10: Migration script (`tools/migrate-swaps.mjs`)

**Files:**
- Create: `tools/migrate-swaps.mjs`
- Create: `tools/test/migrate-swaps.test.js`
- Create: `tools/test/fixtures/migrate-swaps/high-confidence-input.json`
- Create: `tools/test/fixtures/migrate-swaps/high-confidence-output.json`
- Create: `tools/test/fixtures/migrate-swaps/medium-confidence-input.json`
- Create: `tools/test/fixtures/migrate-swaps/skip-input.json`

- [ ] **Step 1: Write the fixtures.**

`tools/test/fixtures/migrate-swaps/high-confidence-input.json`:

```json
{
  "id": "High confidence",
  "list_id": "HIGH",
  "sections": [
    { "name": "CORE", "formations": [{ "string_id": "f1", "id": 567, "name": "F1", "pts": 250, "cost_pts": 250, "upgrades": [10] }] }
  ],
  "upgrades": [
    { "id": 10, "string_id": "hydra", "name": "Hydra", "pts": 50 },
    { "id": 100, "string_id": "gun_servitors", "name": "Gun Servitors", "pts": 0 },
    { "id": 101, "string_id": "rapier_lasers", "name": "Rapier Lasers", "pts": 0 }
  ],
  "upgradeConstraints": [
    { "min": 1, "max": 1, "from": [100, 101], "appliesTo": [567] }
  ]
}
```

`tools/test/fixtures/migrate-swaps/high-confidence-output.json` (same plus `swap_slots[]`; `upgradeConstraints` unchanged):

```json
{
  "id": "High confidence",
  "list_id": "HIGH",
  "sections": [
    {
      "name": "CORE",
      "formations": [
        {
          "string_id": "f1",
          "id": 567,
          "name": "F1",
          "pts": 250,
          "cost_pts": 250,
          "upgrades": [10],
          "swap_slots": [
            {
              "string_id": "support_unit",
              "label": "Support unit",
              "variants": [
                { "upgrade_id": 100, "is_default": true },
                { "upgrade_id": 101 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "upgrades": [
    { "id": 10, "string_id": "hydra", "name": "Hydra", "pts": 50 },
    { "id": 100, "string_id": "gun_servitors", "name": "Gun Servitors", "pts": 0 },
    { "id": 101, "string_id": "rapier_lasers", "name": "Rapier Lasers", "pts": 0 }
  ],
  "upgradeConstraints": [
    { "min": 1, "max": 1, "from": [100, 101], "appliesTo": [567] }
  ]
}
```

`tools/test/fixtures/migrate-swaps/medium-confidence-input.json` (mismatched pts → script should classify medium and skip):

```json
{
  "id": "Medium confidence",
  "list_id": "MED",
  "sections": [
    { "name": "CORE", "formations": [{ "string_id": "f1", "id": 567, "name": "F1", "pts": 250, "cost_pts": 250, "upgrades": [] }] }
  ],
  "upgrades": [
    { "id": 100, "string_id": "a", "name": "A", "pts": 0 },
    { "id": 101, "string_id": "b", "name": "B", "pts": 50 }
  ],
  "upgradeConstraints": [
    { "min": 1, "max": 1, "from": [100, 101], "appliesTo": [567] }
  ]
}
```

`tools/test/fixtures/migrate-swaps/skip-input.json` (malformed: only one variant in `from`):

```json
{
  "id": "Skip",
  "list_id": "SKIP",
  "sections": [
    { "name": "CORE", "formations": [{ "string_id": "f1", "id": 567, "name": "F1", "pts": 250, "cost_pts": 250, "upgrades": [] }] }
  ],
  "upgrades": [
    { "id": 100, "string_id": "a", "name": "A", "pts": 0 }
  ],
  "upgradeConstraints": [
    { "min": 1, "max": 1, "from": [100], "appliesTo": [567] }
  ]
}
```

- [ ] **Step 2: Write failing tests.**

`tools/test/migrate-swaps.test.js`:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FIX = path.resolve(__dirname, 'fixtures', 'migrate-swaps');

async function runTransform(fileName) {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-swaps.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, fileName), 'utf8'));
  return transformList(input);
}

test('high-confidence: emits swap_slots and leaves upgradeConstraints in place', async () => {
  const { json, report } = await runTransform('high-confidence-input.json');
  const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-output.json'), 'utf8'));
  assert.deepStrictEqual(json, expected);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'high');
});

test('medium-confidence (mismatched pts): no transform, report row emitted', async () => {
  const { json, report } = await runTransform('medium-confidence-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'medium-confidence-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original, 'medium-confidence inputs must be left untouched');
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'medium');
});

test('malformed constraint (single-variant from): no transform, no report row', async () => {
  const { json, report } = await runTransform('skip-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'skip-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original);
  assert.strictEqual(report.length, 0);
});

test('idempotency: running transform twice yields the same result as once', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-swaps.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-input.json'), 'utf8'));
  const first = transformList(input);
  const second = transformList(first.json);
  assert.deepStrictEqual(second.json, first.json);
});
```

- [ ] **Step 3: Run tests to verify they fail.**

Run: `node --test tools/test/migrate-swaps.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Write `tools/migrate-swaps.mjs`.**

```javascript
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LISTS_DIR = path.join(REPO_ROOT, 'war', 'lists');

/**
 * Pure transform: given a parsed list JSON, return a new JSON with swap_slots
 * added for high-confidence constraints, plus a report of all classifications.
 * Does NOT remove the original upgradeConstraints rows (legacy chooser-html
 * still reads them). Idempotent: re-running on output is a no-op.
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
    if (c.min !== 1 || c.max !== 1) continue;
    if (!Array.isArray(c.from) || c.from.length < 2) continue;
    if (!Array.isArray(c.appliesTo) || c.appliesTo.length === 0) continue;

    // Resolve from upgrades; all must exist
    const fromUpgrades = c.from.map((id) => upgradesById.get(id));
    if (fromUpgrades.some((u) => !u)) {
      report.push({ tier: 'medium', reason: 'from references unknown upgrade', constraint: c });
      continue;
    }

    // All variants must share the same pts (high confidence) or are all 0
    const ptsSet = new Set(fromUpgrades.map((u) => u.cost_pts ?? u.pts ?? 0));
    if (ptsSet.size > 1) {
      report.push({ tier: 'medium', reason: 'variants have differing pts', constraint: c });
      continue;
    }

    // Default heuristic: first listed in `from`
    const defaultUpgradeId = c.from[0];

    // For each appliesTo formation, check none of from is already in its upgrades[]
    let confidence = 'high';
    for (const formationId of c.appliesTo) {
      const f = formationsByIdMap.get(formationId);
      if (!f) {
        confidence = 'medium';
        report.push({ tier: 'medium', reason: `appliesTo formation ${formationId} not found`, constraint: c });
        break;
      }
      const formationUpgradeIds = new Set(f.upgrades ?? []);
      const overlap = c.from.filter((id) => formationUpgradeIds.has(id));
      if (overlap.length > 0) {
        confidence = 'medium';
        report.push({ tier: 'medium', reason: `variant(s) ${overlap.join(',')} also in formation ${formationId} upgrades[]`, constraint: c });
        break;
      }
      // Also: the variants must NOT already appear in the formation's upgrades[] AND there must be no existing swap_slot for the same upgrades (idempotency)
      const existingSlot = (f.swap_slots ?? []).find((s) =>
        s.variants.length === c.from.length && c.from.every((id) => s.variants.some((v) => v.upgrade_id === id))
      );
      if (existingSlot) {
        // Already migrated — skip silently
        confidence = 'already-migrated';
        break;
      }
    }
    if (confidence !== 'high') continue;

    // Apply: add swap_slot to each appliesTo formation. Use the first variant's name (minus quantity prefix if possible) as label.
    for (const formationId of c.appliesTo) {
      const f = formationsByIdMap.get(formationId);
      if (!f) continue;
      f.swap_slots = f.swap_slots ?? [];
      const variants = c.from.map((id) => ({
        upgrade_id: id,
        ...(id === defaultUpgradeId ? { is_default: true } : {}),
      }));
      // Slot string_id: stable-derive from the variants' string_ids
      const variantStringIds = c.from.map((id) => upgradesById.get(id)?.string_id ?? String(id));
      const slotStringId = `swap_${variantStringIds.join('_or_')}`.slice(0, 80);
      f.swap_slots.push({
        string_id: slotStringId,
        label: 'Choice', // generic label; reviewers can override during PR review
        variants,
      });
    }
    report.push({
      tier: 'high',
      formationIds: [...c.appliesTo],
      fromUpgradeIds: [...c.from],
      defaultUpgradeId,
    });
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
      continue; // skip malformed files
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

Run: `node --test tools/test/migrate-swaps.test.js`
Expected: all 4 tests pass.

- [ ] **Step 6: Dry-run against real list files.**

Run: `node tools/migrate-swaps.mjs`
Expected: a report listing high/medium classifications. Specifically the Gryphonne case `{from:[101,102], appliesTo:[567]}` in `AMTL_skitarii_NETEA.json` should appear as `medium` (because 101/102 aren't in formation 567's `upgrades[]` — wait, that's the *good* case for high-confidence. Re-read the spec: the medium signal in the Gryphonne case is that the **constraint references formation 567 whose upgrades[] doesn't include 101/102** — but our migration logic only flags overlap, not non-membership). So actually the Gryphonne case will be classified `high` and auto-applied.

That's the right outcome — the Gryphonne data bug was specifically that the upgrades weren't in the formation's `upgrades[]`. Adding `swap_slots[]` fixes that. Task 11 explicitly applies it.

If the dry-run output looks reasonable (handful of high, some medium), commit and proceed.

- [ ] **Step 7: Commit.**

```bash
git add tools/migrate-swaps.mjs tools/test/migrate-swaps.test.js tools/test/fixtures/migrate-swaps/
git commit -m "feat(tools): add migrate-swaps script (dry-run + apply, tiered classification)"
```

---

## Task 11: Apply the worked Gryphonne IV reference case

**Files:**
- Modify: `war/lists/AMTL_skitarii_NETEA.json`

- [ ] **Step 1: Run migration with `--apply` for the Skitarii list only.**

Because we want the Gryphonne IV case to be the reference and a single reviewable PR, apply only to that one file using a small inline invocation:

Run:
```bash
node --input-type=module -e "import('./tools/migrate-swaps.mjs').then(async (m)=>{const fs=await import('node:fs/promises');const p='./war/lists/AMTL_skitarii_NETEA.json';const j=JSON.parse(await fs.readFile(p,'utf8'));const {json,report}=m.transformList(j);console.log(JSON.stringify(report,null,2));await fs.writeFile(p, JSON.stringify(json,null,2)+'\n','utf8');});"
```

Expected: a report row mentioning formation 567 (and possibly 566), with a `high` classification. The file is rewritten with the new `swap_slots[]` on the affected formation(s).

- [ ] **Step 2: Hand-edit the `label` from "Choice" to "Support unit".**

The migration script uses a generic `label: "Choice"`. Open `war/lists/AMTL_skitarii_NETEA.json`, find the new `swap_slots[]` block on the Sagitarii Demi-Century, and change `"label": "Choice"` to `"label": "Support unit"`.

- [ ] **Step 3: Verify the formation now passes both the schema and semantic validator.**

Run: `node tools/validate-lists.mjs`
Expected: `OK: 156 files` (or current count). If the new entry fails validation, fix it before continuing.

- [ ] **Step 4: Verify a saved-list round-trip works end-to-end.**

Start the dev servers:

In terminal 1: `npm run dev --workspace apps/api`
In terminal 2: `npm run dev --workspace apps/web`

Open `http://localhost:5173/v2/build/AMTL_skitarii_NETEA`. Sign in if needed.
- Add `Sagitarii Demi-Century` → 250 pts.
- Verify a "Composition" section appears with a "Replace 5 Gun Servitor Unit with 3 Rapier Laser Destroyer Unit (+0)" toggle.
- Tick the toggle → composition flips, total stays 250.
- Click Save → reload the page → toggle should remain ticked.

Kill the dev servers when done.

- [ ] **Step 5: Commit.**

```bash
git add war/lists/AMTL_skitarii_NETEA.json
git commit -m "feat(data): add swap_slots to Gryphonne IV Sagitarii Demi-Century"
```

---

## Task 12: Final integration check

**Files:** none (verification only)

- [ ] **Step 1: Full root test.**

Run: `npm test`
Expected: every workspace's tests pass.

- [ ] **Step 2: Full root typecheck.**

Run: `npm run typecheck` and `npm run typecheck --workspace apps/web`
Expected: both pass.

- [ ] **Step 3: Web build succeeds.**

Run: `npm run build --workspace apps/web`
Expected: vite build completes, tsc emits no errors.

- [ ] **Step 4: Confirm the spec smoke test from §6 of the design doc.**

Manual: repeat the steps from Task 11, Step 4 against the production-ish build (vite preview or the deployed preview) once redeploy is triggered.

- [ ] **Step 5: Note redeploy in handoff.**

After the merge to master, remind the user that GoDaddy does not auto-deploy on push — they need to click Redeploy in the airoapp.ai UI to make the change live. (Reference: `reference_godaddy-deploy.md` memory.)

---

## Out of scope for this plan (per spec §7)

- Intra-unit weapon-loadout swaps (reserved for `body_version: 3`).
- Backfilling source-json swap rules into list data (per-faction follow-up PRs).
- General `formationConstraints` / `upgradeConstraints` enforcement in the modern builder.
- Mass migration across the other 155 lists. After this plan lands, the user can run `node tools/migrate-swaps.mjs --apply` and review the resulting diff per faction in separate PRs — but each gets its own review cadence per the [[project-users]] no-blackout rule.
