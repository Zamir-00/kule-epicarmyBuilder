# Unit-Profile Shared Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 50 hand-maintained `war/js/unitProfiles.*.js` files with a shared `war/js/unitProfileLoader.js` library that the 6 existing DYNAMIC files already prove works in production, then migrate the 43 STATIC files and 1 multi-source file (`eldarCraftworlds`) to the shared pattern.

**Architecture:** One new file `war/js/unitProfileLoader.js` exposes `ArmyforgeUnitProfiles.registerFaction({namespace, findFunctionName, armyIds, sourceJsonPaths, normalizer, aliases})`. Internally it does the sync `Ajax.Request` load of one or more source-json files, clones profiles, derives keys, registers aliases, and attaches `ArmyforgeUnitProfiles[findFunctionName]`. Each faction file shrinks to a normalizer + aliases + `registerFaction(...)` call (+ optional formation-extras). No build step. The loader file is dual-mode: it runs as a browser `<script>` *and* exports its pure helpers via `module.exports` so they can be unit-tested under Node.

**Tech Stack:** Vanilla ES5 (the only flavor that runs alongside the existing Prototype.js-era code). Node 24's built-in `node:test` for unit tests (zero deps). No `package.json`, no build pipeline.

**Spec:** `docs/superpowers/specs/2026-05-26-source-json-to-unit-profiles-generator-design.md` (commit `1c1f750`).

---

## File map

**Create:**
- `war/js/unitProfileLoader.js` — the shared loader, dual-mode (browser script + Node CJS module)
- `war/js/unitProfileLoader.md` — short README documenting the registerFaction API and how to add a faction
- `tools/test/loader.test.js` — `node:test` unit tests for pure helpers
- `tools/test/fixtures/sample-source.json` — small source-json fixture
- `tools/inventory-factions.js` — one-shot script that lists which `unitProfiles.*.js` files map to which `source-json/*.json` files, flags gaps

**Modify:**
- `war/chooser.html` — add one `<script>` tag for `unitProfileLoader.js` before the first `unitProfiles.*.js` tag (currently `chooser.html:11`)
- `war/js/unitProfiles.deathGuard.js` — Task 11 pilot refactor (DYNAMIC → registerFaction)
- `war/js/unitProfiles.smCodexAstartes.js` — Task 13 pilot migration (STATIC → registerFaction)
- `war/js/unitProfiles.exploratorFleet.js` — Task 16 bulk DYNAMIC
- `war/js/unitProfiles.hedonicCrusade.js` — Task 16 bulk DYNAMIC
- `war/js/unitProfiles.thousandSons.js` — Task 16 bulk DYNAMIC
- `war/js/unitProfiles.traitorTitanLegions.js` — Task 16 bulk DYNAMIC
- `war/js/unitProfiles.vraksianTraitors.js` — Task 16 bulk DYNAMIC
- Remaining 42 STATIC `unitProfiles.*.js` files — Task 17 bulk migration
- `war/js/unitProfiles.eldarCraftworlds.js` — Task 18 multi-source migration

---

## Task 1: Scaffold the test directory and a fixture

**Files:**
- Create: `tools/test/fixtures/sample-source.json`
- Create: `tools/test/loader.test.js` (stub)

- [ ] **Step 1: Create the fixture file**

Create `tools/test/fixtures/sample-source.json` with content matching the real source-json shape from `war/source-json/death-guard.json`:

```json
{
  "metadata": {
    "army_name": "Sample",
    "list_id": "TEST_NETEA"
  },
  "profiles": [
    {
      "name": "Plague Marines",
      "type": "INF",
      "speed": "15cm",
      "armour": "4+",
      "cc": "4+",
      "ff": "4+",
      "weapons": [
        {
          "name": "Bolters",
          "range": "15cm",
          "firepower": "Small Arms",
          "notes": ["MW"]
        }
      ],
      "abilities_or_notes": ["Reinforced Armour", "Slow and Steady"],
      "source_section": "Reference (test)",
      "parse_confidence": "high",
      "parse_warnings": [],
      "is_reference_or_ambiguous": false
    },
    {
      "name": "Lord of Contagion",
      "type": "CH",
      "speed": "n/a",
      "armour": "n/a",
      "cc": "n/a",
      "ff": "n/a",
      "weapons": [
        {
          "name": "Manreaper",
          "range": "(base contact)",
          "firepower": "Assault Weapons",
          "notes": ["EA(+1)", "MW"]
        }
      ],
      "abilities_or_notes": ["Invulnerable Save", "Supreme Commander"]
    }
  ]
}
```

- [ ] **Step 2: Create the test file stub**

```js
// tools/test/loader.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

// The loader is dual-mode: a browser <script> AND a CJS module.
// require() triggers the module.exports branch at the end of the IIFE.
const loaderPath = path.resolve(__dirname, '..', '..', 'war', 'js', 'unitProfileLoader.js');

test('loader module loads under Node without throwing', () => {
    const loader = require(loaderPath);
    assert.ok(loader, 'loader should export an object');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```
node --test tools/test/loader.test.js
```

Expected: FAIL — `Cannot find module '.../war/js/unitProfileLoader.js'`. The loader file doesn't exist yet.

- [ ] **Step 4: Commit**

```
git add tools/test/fixtures/sample-source.json tools/test/loader.test.js
git commit -m "test: scaffold loader test suite with sample fixture"
```

---

## Task 2: Scaffold the loader file with dual-mode exports

**Files:**
- Create: `war/js/unitProfileLoader.js`

- [ ] **Step 1: Create the loader file with the minimal IIFE skeleton and module.exports**

```js
// war/js/unitProfileLoader.js
// Shared loader for unit-profile faction files.
// Loaded by chooser.html before any unitProfiles.<faction>.js script tag.
// Provides ArmyforgeUnitProfiles.registerFaction(config) — see ./unitProfileLoader.md

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

(function() {
    // Pure helpers (also exported for unit tests under Node).

    function cloneProfile(profile) {
        return profile;  // placeholder, replaced in Task 3
    }

    function deriveKey(name, normalizer) {
        return '';  // placeholder, replaced in Task 4
    }

    function registerAlias(faction, alias, key, normalizer) {
        // placeholder, replaced in Task 5
    }

    function buildFinder(namespace, normalizer) {
        return function() { return null; };  // placeholder, replaced in Task 6
    }

    function loadSourceJsonSync(path) {
        return null;  // placeholder, replaced in Task 7
    }

    function registerFaction(config) {
        // placeholder, replaced in Task 8
    }

    // Public API
    ArmyforgeUnitProfiles.registerFaction = registerFaction;

    // CJS export for unit tests under Node. Skipped in browser (no `module`).
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            cloneProfile: cloneProfile,
            deriveKey: deriveKey,
            registerAlias: registerAlias,
            buildFinder: buildFinder,
            registerFaction: registerFaction
        };
    }
})();
```

- [ ] **Step 2: Run the test from Task 1 to verify it now passes**

Run:
```
node --test tools/test/loader.test.js
```

Expected: PASS — 1 test passes, `loader module loads under Node without throwing`.

- [ ] **Step 3: Commit**

```
git add war/js/unitProfileLoader.js
git commit -m "feat: scaffold unitProfileLoader.js with dual-mode skeleton"
```

---

## Task 3: Implement cloneProfile (TDD)

**Files:**
- Modify: `tools/test/loader.test.js`
- Modify: `war/js/unitProfileLoader.js`

- [ ] **Step 1: Append failing tests for cloneProfile**

Append to `tools/test/loader.test.js`:

```js
test('cloneProfile renames abilities_or_notes to abilities', () => {
    const { cloneProfile } = require(loaderPath);
    const input = {
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [],
        abilities_or_notes: ['Leader', 'MW']
    };
    const result = cloneProfile(input);
    assert.deepStrictEqual(result.abilities, ['Leader', 'MW']);
    assert.strictEqual(result.abilities_or_notes, undefined);
});

test('cloneProfile falls back to abilities when abilities_or_notes is absent', () => {
    const { cloneProfile } = require(loaderPath);
    const result = cloneProfile({
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [],
        abilities: ['Scout', 'Infiltrator']
    });
    assert.deepStrictEqual(result.abilities, ['Scout', 'Infiltrator']);
});

test('cloneProfile deep-copies weapons and their notes', () => {
    const { cloneProfile } = require(loaderPath);
    const input = {
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [{ name: 'Bolter', range: '15cm', firepower: 'Small Arms', notes: ['MW'] }],
        abilities_or_notes: []
    };
    const result = cloneProfile(input);
    // Mutating the original should not affect the clone.
    input.weapons[0].notes.push('EA(+1)');
    assert.deepStrictEqual(result.weapons[0].notes, ['MW']);
});

test('cloneProfile drops provenance fields (parse_confidence etc.)', () => {
    const { cloneProfile } = require(loaderPath);
    const result = cloneProfile({
        name: 'X', type: 'INF', speed: '15cm', armour: '4+', cc: '4+', ff: '4+',
        weapons: [], abilities_or_notes: [],
        source_section: 'Whatever',
        parse_confidence: 'high',
        parse_warnings: ['stuff'],
        ambiguity_reasons: ['stuff'],
        is_reference_or_ambiguous: true
    });
    assert.strictEqual(result.source_section, undefined);
    assert.strictEqual(result.parse_confidence, undefined);
    assert.strictEqual(result.parse_warnings, undefined);
    assert.strictEqual(result.ambiguity_reasons, undefined);
    assert.strictEqual(result.is_reference_or_ambiguous, undefined);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
node --test tools/test/loader.test.js
```

Expected: FAIL — 4 new tests fail because `cloneProfile` is still the placeholder returning the input unchanged.

- [ ] **Step 3: Replace the cloneProfile placeholder with the real implementation**

In `war/js/unitProfileLoader.js`, replace the `cloneProfile` function body:

```js
    function cloneProfile(profile) {
        return {
            name: profile.name,
            type: profile.type,
            speed: profile.speed,
            armour: profile.armour,
            cc: profile.cc,
            ff: profile.ff,
            weapons: (profile.weapons || []).map(function(w) {
                return {
                    name: w.name,
                    range: w.range,
                    firepower: w.firepower,
                    notes: (w.notes || []).slice()
                };
            }),
            abilities: (profile.abilities_or_notes || profile.abilities || []).slice()
        };
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
node --test tools/test/loader.test.js
```

Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```
git add war/js/unitProfileLoader.js tools/test/loader.test.js
git commit -m "feat(loader): implement cloneProfile with abilities/provenance handling"
```

---

## Task 4: Implement deriveKey (TDD)

**Files:**
- Modify: `tools/test/loader.test.js`
- Modify: `war/js/unitProfileLoader.js`

- [ ] **Step 1: Append failing tests**

Append to `tools/test/loader.test.js`:

```js
test('deriveKey converts name to snake_case via normalizer', () => {
    const { deriveKey } = require(loaderPath);
    const noopNormalizer = (s) => String(s).toLowerCase();
    assert.strictEqual(deriveKey('Lord of Contagion', noopNormalizer), 'lord_of_contagion');
    assert.strictEqual(deriveKey('Plague  Marines', noopNormalizer), 'plague_marines');
});

test('deriveKey returns empty string when normalizer returns empty', () => {
    const { deriveKey } = require(loaderPath);
    const stripNormalizer = () => '';
    assert.strictEqual(deriveKey('whatever', stripNormalizer), '');
});

test('deriveKey is empty for empty input', () => {
    const { deriveKey } = require(loaderPath);
    const noopNormalizer = (s) => String(s || '').toLowerCase();
    assert.strictEqual(deriveKey('', noopNormalizer), '');
    assert.strictEqual(deriveKey(null, noopNormalizer), '');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
node --test tools/test/loader.test.js
```

Expected: FAIL — 3 new `deriveKey` tests fail.

- [ ] **Step 3: Replace the deriveKey placeholder**

In `war/js/unitProfileLoader.js`:

```js
    function deriveKey(name, normalizer) {
        if (!name) return '';
        var normalized = normalizer(name);
        if (!normalized) return '';
        return normalized.replace(/\s+/g, '_');
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
node --test tools/test/loader.test.js
```

Expected: PASS — all tests so far pass.

- [ ] **Step 5: Commit**

```
git add war/js/unitProfileLoader.js tools/test/loader.test.js
git commit -m "feat(loader): implement deriveKey"
```

---

## Task 5: Implement registerAlias (TDD)

**Files:**
- Modify: `tools/test/loader.test.js`
- Modify: `war/js/unitProfileLoader.js`

- [ ] **Step 1: Append failing tests**

Append to `tools/test/loader.test.js`:

```js
test('registerAlias stores normalized alias → key', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const normalizer = (s) => String(s).toLowerCase();
    registerAlias(faction, 'Plague Marines', 'plague_marines', normalizer);
    assert.strictEqual(faction.nameToKey['plague marines'], 'plague_marines');
});

test('registerAlias also stores compact (no-space) variant', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const normalizer = (s) => String(s).toLowerCase();
    registerAlias(faction, 'Plague Marines', 'plague_marines', normalizer);
    assert.strictEqual(faction.nameToKey['plaguemarines'], 'plague_marines');
});

test('registerAlias is a no-op when alias or key is empty', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const normalizer = (s) => String(s || '').toLowerCase();
    registerAlias(faction, '', 'k', normalizer);
    registerAlias(faction, 'a', '', normalizer);
    assert.deepStrictEqual(faction.nameToKey, {});
});

test('registerAlias is a no-op when normalizer returns empty', () => {
    const { registerAlias } = require(loaderPath);
    const faction = { armyIds: [], profiles: {}, nameToKey: {} };
    const stripNormalizer = () => '';
    registerAlias(faction, 'whatever', 'k', stripNormalizer);
    assert.deepStrictEqual(faction.nameToKey, {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
node --test tools/test/loader.test.js
```

Expected: FAIL — 4 new `registerAlias` tests fail.

- [ ] **Step 3: Replace the registerAlias placeholder**

In `war/js/unitProfileLoader.js`:

```js
    function registerAlias(faction, alias, key, normalizer) {
        if (!alias || !key) return;
        var normalized = normalizer(alias);
        if (!normalized) return;
        faction.nameToKey[normalized] = key;
        var compact = normalized.replace(/\s+/g, '');
        if (compact && compact !== normalized) {
            faction.nameToKey[compact] = key;
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
node --test tools/test/loader.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add war/js/unitProfileLoader.js tools/test/loader.test.js
git commit -m "feat(loader): implement registerAlias with compact variant"
```

---

## Task 6: Implement buildFinder (TDD)

**Files:**
- Modify: `tools/test/loader.test.js`
- Modify: `war/js/unitProfileLoader.js`

- [ ] **Step 1: Append failing tests**

Append to `tools/test/loader.test.js`:

```js
test('buildFinder returns null for empty displayName', () => {
    const { buildFinder } = require(loaderPath);
    // Set up a faction in the global namespace for the finder to look up.
    global.ArmyforgeUnitProfiles = global.ArmyforgeUnitProfiles || {};
    global.ArmyforgeUnitProfiles.testNs = {
        armyIds: ['TEST_NETEA'],
        profiles: { plague_marines: { name: 'Plague Marines' } },
        nameToKey: { 'plague marines': 'plague_marines' }
    };
    // Stub Array.prototype.member (used by Prototype.js; absent in plain Node).
    if (!Array.prototype.member) {
        Array.prototype.member = function(value) { return this.indexOf(value) !== -1; };
    }
    const noopNormalizer = (s) => String(s || '').toLowerCase();
    const finder = buildFinder('testNs', noopNormalizer);
    assert.strictEqual(finder('', 'TEST_NETEA'), null);
    assert.strictEqual(finder(null, 'TEST_NETEA'), null);
});

test('buildFinder returns null when listId does not match armyIds', () => {
    const { buildFinder } = require(loaderPath);
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    assert.strictEqual(finder('Plague Marines', 'WRONG_ID'), null);
});

test('buildFinder resolves displayName via nameToKey', () => {
    const { buildFinder } = require(loaderPath);
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    const result = finder('Plague Marines', 'TEST_NETEA');
    assert.strictEqual(result.name, 'Plague Marines');
});

test('buildFinder falls back to compact (no-space) lookup', () => {
    const { buildFinder } = require(loaderPath);
    global.ArmyforgeUnitProfiles.testNs.nameToKey = { 'plaguemarines': 'plague_marines' };
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    const result = finder('Plague Marines', 'TEST_NETEA');
    assert.strictEqual(result.name, 'Plague Marines');
});

test('buildFinder returns null when key resolution fails', () => {
    const { buildFinder } = require(loaderPath);
    global.ArmyforgeUnitProfiles.testNs.nameToKey = {};
    const finder = buildFinder('testNs', (s) => String(s).toLowerCase());
    assert.strictEqual(finder('Plague Marines', 'TEST_NETEA'), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
node --test tools/test/loader.test.js
```

Expected: FAIL — buildFinder tests fail (placeholder always returns null, so some "fail expected" cases pass by accident; the resolution tests definitely fail).

- [ ] **Step 3: Replace the buildFinder placeholder**

In `war/js/unitProfileLoader.js`:

```js
    function buildFinder(namespace, normalizer) {
        return function(displayName, listId) {
            if (!displayName) return null;
            var faction = ArmyforgeUnitProfiles[namespace];
            if (!faction) return null;
            if (listId && !faction.armyIds.member(listId)) return null;
            var normalized = normalizer(displayName);
            var key = faction.nameToKey[normalized] ||
                      faction.nameToKey[normalized.replace(/\s+/g, '')];
            if (!key) return null;
            return faction.profiles[key] || null;
        };
    }
```

Note: this references `ArmyforgeUnitProfiles[namespace]` via the global. In Node tests we set `global.ArmyforgeUnitProfiles` to make it accessible; in the browser it's the natural global.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
node --test tools/test/loader.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add war/js/unitProfileLoader.js tools/test/loader.test.js
git commit -m "feat(loader): implement buildFinder mirroring existing per-faction shape"
```

---

## Task 7: Implement loadSourceJsonSync (no unit test)

**Files:**
- Modify: `war/js/unitProfileLoader.js`

This function depends on the browser-only `Ajax.Request` global from Prototype.js. It can't be unit-tested under plain Node without stubbing the entire Prototype.js API. It's covered by the browser smoke test in Task 10.

- [ ] **Step 1: Replace the loadSourceJsonSync placeholder**

In `war/js/unitProfileLoader.js`:

```js
    function loadSourceJsonSync(sourcePath) {
        var responseText = null;
        try {
            new Ajax.Request(sourcePath, {
                method: 'get',
                asynchronous: false,
                onSuccess: function(response) { responseText = response.responseText; }
            });
        } catch (err) {
            console.warn('unitProfileLoader: Ajax error for ' + sourcePath, err);
            return null;
        }
        if (!responseText) {
            console.warn('unitProfileLoader: empty response for ' + sourcePath);
            return null;
        }
        try {
            return JSON.parse(responseText);
        } catch (err2) {
            console.warn('unitProfileLoader: JSON parse error for ' + sourcePath, err2);
            return null;
        }
    }
```

- [ ] **Step 2: Verify the existing tests still pass (no behavior change for them)**

Run:
```
node --test tools/test/loader.test.js
```

Expected: PASS — the function isn't called by any test directly.

- [ ] **Step 3: Commit**

```
git add war/js/unitProfileLoader.js
git commit -m "feat(loader): implement loadSourceJsonSync (Ajax.Request wrapper)"
```

---

## Task 8: Implement registerFaction (integration)

**Files:**
- Modify: `tools/test/loader.test.js`
- Modify: `war/js/unitProfileLoader.js`

- [ ] **Step 1: Append integration test that stubs Ajax and exercises registerFaction end-to-end**

Append to `tools/test/loader.test.js`:

```js
test('registerFaction loads source-json, registers profiles and aliases, attaches finder', () => {
    const { registerFaction } = require(loaderPath);
    const fs = require('fs');
    const fixturePath = path.resolve(__dirname, 'fixtures', 'sample-source.json');
    const fixtureBody = fs.readFileSync(fixturePath, 'utf8');

    // Stub Prototype.js Ajax.Request — captures the path and returns the fixture body.
    global.Ajax = {
        Request: function(reqPath, opts) {
            opts.onSuccess({ responseText: fixtureBody });
        }
    };
    if (!Array.prototype.member) {
        Array.prototype.member = function(value) { return this.indexOf(value) !== -1; };
    }
    global.ArmyforgeUnitProfiles = global.ArmyforgeUnitProfiles || {};

    registerFaction({
        namespace: 'sampleFaction',
        findFunctionName: 'findSampleFactionProfileByName',
        armyIds: ['TEST_NETEA'],
        sourceJsonPaths: [fixturePath],
        normalizer: (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
        aliases: {
            'Plague Marine Retinue': 'Plague Marines',
            'Lord of Contagion': 'Lord of Contagion'
        }
    });

    const ns = global.ArmyforgeUnitProfiles.sampleFaction;
    assert.ok(ns, 'namespace attached');
    assert.deepStrictEqual(ns.armyIds, ['TEST_NETEA']);
    assert.ok(ns.profiles.plague_marines, 'plague_marines profile registered');
    assert.strictEqual(ns.profiles.plague_marines.name, 'Plague Marines');
    assert.ok(ns.profiles.lord_of_contagion, 'lord_of_contagion profile registered');

    // Aliases were registered.
    assert.strictEqual(ns.nameToKey['plague marine retinue'], 'plague_marines');

    // Finder function attached and resolves both direct names and aliases.
    const finder = global.ArmyforgeUnitProfiles.findSampleFactionProfileByName;
    assert.ok(typeof finder === 'function', 'finder attached');
    assert.strictEqual(finder('Plague Marines', 'TEST_NETEA').name, 'Plague Marines');
    assert.strictEqual(finder('Plague Marine Retinue', 'TEST_NETEA').name, 'Plague Marines');
    assert.strictEqual(finder('Unknown Unit', 'TEST_NETEA'), null);
});

test('registerFaction throws when required config field missing', () => {
    const { registerFaction } = require(loaderPath);
    assert.throws(() => registerFaction({}), /missing required fields/);
    assert.throws(() => registerFaction({ namespace: 'x' }), /missing required fields/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
node --test tools/test/loader.test.js
```

Expected: FAIL — `registerFaction` is still the placeholder no-op.

- [ ] **Step 3: Replace the registerFaction placeholder**

In `war/js/unitProfileLoader.js`:

```js
    function registerFaction(config) {
        if (!config ||
            !config.namespace ||
            !config.findFunctionName ||
            !config.armyIds ||
            !config.sourceJsonPaths ||
            !config.normalizer) {
            throw new Error('unitProfileLoader: registerFaction config missing required fields ' +
                            '(namespace, findFunctionName, armyIds, sourceJsonPaths, normalizer)');
        }

        var faction = ArmyforgeUnitProfiles[config.namespace] || {
            armyIds: config.armyIds.slice(),
            profiles: {},
            nameToKey: {}
        };
        ArmyforgeUnitProfiles[config.namespace] = faction;

        // Load and merge profiles from all source paths.
        var allProfiles = [];
        for (var i = 0; i < config.sourceJsonPaths.length; i++) {
            var data = loadSourceJsonSync(config.sourceJsonPaths[i]);
            if (data && data.profiles && data.profiles.length) {
                for (var j = 0; j < data.profiles.length; j++) {
                    allProfiles.push(data.profiles[j]);
                }
            }
        }

        // Register each profile under its derived key, plus self-alias by its name.
        for (var p = 0; p < allProfiles.length; p++) {
            var profile = allProfiles[p];
            var key = deriveKey(profile.name, config.normalizer);
            if (!key) continue;
            if (faction.profiles[key]) {
                console.warn('unitProfileLoader: profile key collision for "' + key +
                             '" (namespace: ' + config.namespace + ')');
            }
            faction.profiles[key] = cloneProfile(profile);
            registerAlias(faction, profile.name, key, config.normalizer);
        }

        // Register the explicit aliases. Alias target must resolve to an existing profile key.
        var aliases = config.aliases || {};
        for (var alias in aliases) {
            if (!Object.prototype.hasOwnProperty.call(aliases, alias)) continue;
            var targetName = aliases[alias];
            var targetKey = deriveKey(targetName, config.normalizer);
            if (!targetKey) continue;
            registerAlias(faction, alias, targetKey, config.normalizer);
        }

        ArmyforgeUnitProfiles[config.findFunctionName] = buildFinder(config.namespace, config.normalizer);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
node --test tools/test/loader.test.js
```

Expected: PASS — all loader tests pass.

- [ ] **Step 5: Commit**

```
git add war/js/unitProfileLoader.js tools/test/loader.test.js
git commit -m "feat(loader): implement registerFaction end-to-end"
```

---

## Task 9: Wire the loader into chooser.html

**Files:**
- Modify: `war/chooser.html:11` (insert a new script tag before this line)

- [ ] **Step 1: Read the first 15 lines of chooser.html**

Run:
```
head -15 war/chooser.html
```

Confirm line 11 starts with `<script type="text/javascript" src="./js/unitProfiles.chaosCultistSlavesToDarkness.js"></script>` and lines 10 and earlier are non-unitProfile content (likely `<head>` open + other scripts).

- [ ] **Step 2: Insert the loader script tag before line 11**

The new line must be inserted at exactly line 11 of `chooser.html`, shifting all existing unitProfile script tags down by one. Use the Edit tool with the exact text from the current line 11 (preserving any leading whitespace).

New line content:
```
	<script type="text/javascript" src="./js/unitProfileLoader.js"></script>
```

Place it immediately before the existing line 11. Match the indentation (tab or spaces) of surrounding lines.

- [ ] **Step 3: Verify the script tag order**

Run:
```
grep -n "unitProfileLoader\|unitProfiles\." war/chooser.html | head -5
```

Expected output (line numbers shifted by 1):
```
11:	<script type="text/javascript" src="./js/unitProfileLoader.js"></script>
12:	<script type="text/javascript" src="./js/unitProfiles.chaosCultistSlavesToDarkness.js"></script>
...
```

The loader MUST appear before any `unitProfiles.<faction>.js` tag.

- [ ] **Step 4: Commit**

```
git add war/chooser.html
git commit -m "feat: load unitProfileLoader.js before faction profile scripts in chooser.html"
```

---

## Task 10: Browser smoke test — zero behavior change

**Files:** none modified

This step verifies the loader is loaded but unused — it should be a no-op at this point because no faction file calls `registerFaction` yet.

- [ ] **Step 1: Serve war/ via a local HTTP server**

The HTML files use relative paths like `./source-json/...` which only work over HTTP, not `file://`. Run:

```
cd war && python3 -m http.server 8000
```

This starts a server on port 8000. Leave it running for Steps 2-3.

- [ ] **Step 2: Open chooser.html and verify a STATIC faction list renders**

In a browser, open: `http://localhost:8000/chooser.html?list=SM_codex_NETEA`

Expected:
- No JavaScript console errors. Open DevTools → Console.
- The Codex Astartes army list builder renders normally.
- Click a formation entry (e.g. "Tactical Detachment") — the unit card popup shows correct stats (matches today's behavior, since no faction file uses the loader yet).

- [ ] **Step 3: Verify a DYNAMIC faction list still renders**

Navigate to: `http://localhost:8000/chooser.html?list=CHAOS_dg_NETEA`

Expected:
- Death Guard renders normally.
- Unit cards show Plague Marine, Lord of Contagion, etc. statlines.
- No console errors.

- [ ] **Step 4: Stop the server**

Ctrl+C the `python3 -m http.server 8000` process.

- [ ] **Step 5: Commit (empty commit for the verification milestone)**

```
git commit --allow-empty -m "verify: loader loaded but unused — baseline behavior unchanged"
```

This explicit milestone commit makes Step 1 of the spec's rollout independently revertable.

---

## Task 11: Pilot DYNAMIC migration — refactor unitProfiles.deathGuard.js

**Files:**
- Modify: `war/js/unitProfiles.deathGuard.js`

- [ ] **Step 1: Read the current deathGuard.js end-to-end to preserve every behavior**

Run:
```
wc -l war/js/unitProfiles.deathGuard.js
```

Expected: ~410 lines.

Read the full file. Identify the pieces that MUST be preserved:
- `ArmyforgeUnitProfiles.normalizeDeathGuardName` (the per-faction normalizer)
- The 80-entry `aliases` object literal (lines 113-195)
- `ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade` (helper used by formation-extras)
- `ArmyforgeUnitProfiles.deathGuardAdditionalProfilesForFormation` (per-formation extra-card logic)

Identify what gets DELETED (replaced by the shared loader):
- `loadSourceData()` — inline Ajax wrapper
- `cloneProfile()` — inline clone helper
- `registerAlias()` — inline alias registrar
- The IIFE body that walks aliases and registers them
- `ArmyforgeUnitProfiles.findDeathGuardProfileByName` (the loader builds this)

- [ ] **Step 2: Rewrite the file**

Replace the whole file with:

```js
// Source: war/source-json/death-guard.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeDeathGuardName = ArmyforgeUnitProfiles.normalizeDeathGuardName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/[’']/g, '')
		.replace(/\bdeath guard\b/g, ' ')
		.replace(/\bhellblades\b/g, 'hellblade')
		.replace(/\bhelltalons\b/g, 'hell talon')
		// ... (PRESERVE the full normalizer body from the original file, lines 5-32)
		.replace(/\b(army|formation|formations|company|companies|retinue|retinues|platoon|platoons|squadron|squadrons|battery|batteries|swarm|swarms|pool|upgrades?|upgrade|of|the|a|an|any|one|two|three|four|five|six|seven|eight|nine|ten|with|and|or|plus|per|for|may|take|add|replace|unit|units)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'deathGuard',
	findFunctionName: 'findDeathGuardProfileByName',
	armyIds: ['CHAOS_dg_NETEA'],
	sourceJsonPaths: ['./source-json/death-guard.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeDeathGuardName,
	aliases: {
		// PRESERVE the full 80-entry aliases object from the original file, lines 113-195
		'1+ Plague Marine Retinue': 'Plague Marines',
		'Plague Marine Retinue': 'Plague Marines',
		// ...
		'Vindicators': 'Death Guard Vindicator',
		'Walkers': 'Defiler'
	}
});

ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade = function(formation, pattern) {
	// PRESERVE unchanged from original, lines 223-230
	if (!formation || !formation.upgrades || !pattern) {
		return false;
	}
	return formation.upgrades.any(function(u) {
		return u && u.name && pattern.test(u.name);
	});
};

ArmyforgeUnitProfiles.deathGuardAdditionalProfilesForFormation = function(formation) {
	// PRESERVE unchanged from original, lines 232-410 (or however far it extends)
	// This is the big per-formation extras switch.
	// ...
};
```

CRITICAL: when filling in the elided parts, copy them VERBATIM from the original file. Do not refactor or simplify any of the normalizer regex, aliases entries, or the formation-extras function. The goal is "use the shared loader" not "rewrite faction logic".

- [ ] **Step 3: Confirm line count dropped meaningfully**

Run:
```
wc -l war/js/unitProfiles.deathGuard.js
```

Expected: dropped from ~410 to ~250-280 (the formation-extras section is the bulk of remaining lines).

- [ ] **Step 4: Commit**

```
git add war/js/unitProfiles.deathGuard.js
git commit -m "refactor(deathGuard): use shared unitProfileLoader, delete copy-pasted Ajax/clone/registerAlias"
```

---

## Task 12: Browser verify deathGuard after refactor

**Files:** none modified

- [ ] **Step 1: Start the local server**

```
cd war && python3 -m http.server 8000
```

- [ ] **Step 2: Load CHAOS_dg_NETEA and check unit cards**

Open `http://localhost:8000/chooser.html?list=CHAOS_dg_NETEA`.

Expected:
- No console errors.
- Build a small army: pick a "Plague Marine Retinue" formation. Hover/click unit entries and confirm the unit card shows: name = Plague Marines, type = INF, speed = 15cm, armour/cc/ff matching today's values.
- Try a "Walker Horde" formation with an upgrade (e.g. Defiler) — confirm the extra-cards logic still surfaces the Defiler statline (this exercises `deathGuardAdditionalProfilesForFormation`).
- Try a "Hellblades" formation — confirm Hellblade card appears.

If any unit card is missing or wrong, the refactor lost something. Revert (`git revert HEAD`), diff against the original to find what was dropped, retry.

- [ ] **Step 3: Stop the server**

Ctrl+C.

- [ ] **Step 4: Commit verification milestone**

```
git commit --allow-empty -m "verify: CHAOS_dg_NETEA renders identically after loader refactor"
```

---

## Task 13: Pilot STATIC migration — migrate unitProfiles.smCodexAstartes.js

**Files:**
- Modify: `war/js/unitProfiles.smCodexAstartes.js`

This is the **validation gate** — the riskiest task. STATIC files hardcode their profile data; the loader will replace that with whatever's in `source-json/space-marine-codex-astartes.json`. Any drift between the two surfaces here.

- [ ] **Step 1: Take a baseline screenshot of the current SM_codex_NETEA UI**

```
cd war && python3 -m http.server 8000
```

Open `http://localhost:8000/chooser.html?list=SM_codex_NETEA`. Build a sample army with one of each formation type (Tactical, Assault, Devastator, Bike, Land Raider, Land Speeder, Strike Cruiser, Warhound Titan). For each, hover the formation header to see the unit cards. Screenshot all cards. Save screenshots to a temporary location (e.g. `/tmp/smCodex-baseline/`).

Stop the server (Ctrl+C).

- [ ] **Step 2: Read the existing smCodexAstartes.js**

Run:
```
wc -l war/js/unitProfiles.smCodexAstartes.js
head -10 war/js/unitProfiles.smCodexAstartes.js
```

Note: this file has armyIds for `SM_codex_NETEA` ONLY today (line 13). The file's `nameToKey` table (lines 96-122) has ~200+ alias entries that handle chapter-specific names like 'salamander tactical units'.

- [ ] **Step 3: Rewrite the file**

Replace the whole file with:

```js
// Source: war/source-json/space-marine-codex-astartes.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeSpaceMarineListName = ArmyforgeUnitProfiles.normalizeSpaceMarineListName || function(displayName) {
	// PRESERVE the normalizer from the original file, lines 125-138
	if (!displayName) {
		return '';
	}
	return displayName.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\b(one|two|three|four|five|six)\b/g, '')
		.replace(/\bplus transport\b/g, '')
		.replace(/\btransport\b/g, '')
		.replace(/\b(detachment|detachments|pack)\b/g, '')
		.replace(/\b(space marine|space wolves|salamander|salamanders|white scar|white scars)\b/g, '')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'smCodexAstartes',
	findFunctionName: 'findSmCodexAstartesProfileByName',
	armyIds: ['SM_codex_NETEA'],
	sourceJsonPaths: ['./source-json/space-marine-codex-astartes.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeSpaceMarineListName,
	aliases: {
		// PRESERVE every entry from the original nameToKey object at lines 96-122.
		// The original maps lowercase normalized names → snake_case keys;
		// the loader rewrites these as "alias display name" → "target profile name"
		// where the target name MUST match a profile.name in source-json.
		// For most entries this is identity (e.g. 'Tactical Marines': 'Tactical Marines').
		// For known synonyms (e.g. 'salamander tactical units' → tactical_marines key),
		// map free-text → canonical profile name (e.g. 'Salamander Tactical Units': 'Tactical Marines').
		'Tactical': 'Tactical Marines',
		'Tactical Marine': 'Tactical Marines',
		'Tactical Marines': 'Tactical Marines',
		'Tactical Unit': 'Tactical Marines',
		'Tactical Units': 'Tactical Marines',
		'Tacticals': 'Tactical Marines',
		'Heavy Tactical': 'Tactical Marines',
		'Salamander Tactical Units': 'Tactical Marines',
		'Assault': 'Assault Marines',
		'Assault Marine': 'Assault Marines',
		// ... (translate every entry in the original nameToKey to this shape)
		// IMPORTANT: the *target* values are profile.name strings as they appear
		// in source-json/space-marine-codex-astartes.json, NOT snake_case keys.
		// The loader will derive the snake_case key via the normalizer.
	}
});
```

To translate from the original `nameToKey` (which maps `'normalized name': 'snake_case_key'`) to the new `aliases` (which maps `'Display Name': 'Profile.name'`):

For each entry in the old `nameToKey`:
1. The old key (e.g. `'tactical'`) is the alias's normalized form. Use a representative display-name form (e.g. `'Tactical'`, capitalized).
2. The old value (e.g. `'tactical_marines'`) is the snake_case key. Find the matching profile in `source-json/space-marine-codex-astartes.json` whose `name` slugifies to that key. The matching profile's `name` field (e.g. `'Tactical Marines'`) is the new alias target.

A faster approach: write a one-off helper script `tools/translate-name-to-key.js` that reads the old `nameToKey` from the JS file and the profiles from the source-json, then prints the new `aliases` block. This is mechanical and worth automating to avoid transcription errors. Sketch:

```js
// tools/translate-name-to-key.js (one-off, not committed)
const fs = require('fs');
const path = require('path');
const sourceJson = JSON.parse(fs.readFileSync('war/source-json/space-marine-codex-astartes.json', 'utf8'));

// Build snake_case_key → profile.name lookup from source-json.
const keyToName = {};
for (const p of sourceJson.profiles) {
    if (!p.name) continue;
    const key = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    keyToName[key] = p.name;
}

// Paste the old nameToKey table here, then transform:
const oldNameToKey = {
    'tactical': 'tactical_marines',
    'tactical marine': 'tactical_marines',
    // ... (paste entire original nameToKey block)
};

for (const [alias, snakeKey] of Object.entries(oldNameToKey)) {
    const target = keyToName[snakeKey] || `__MISSING:${snakeKey}__`;
    console.log(`\t\t${JSON.stringify(alias)}: ${JSON.stringify(target)},`);
}
```

Run it (`node tools/translate-name-to-key.js`) and copy the output into the new `aliases` block. Any `__MISSING:<key>__` entries flag profiles that exist in the old JS file but not in source-json — those need separate resolution (likely add to source-json) before Task 14 succeeds.

- [ ] **Step 4: Run the translate script and inspect for MISSING markers**

Save the script as `tools/translate-name-to-key.js` (don't commit it — it's a one-shot tool). Run:

```
node tools/translate-name-to-key.js > /tmp/sm-aliases.txt
grep MISSING /tmp/sm-aliases.txt
```

If grep finds any matches, those profile keys are referenced by aliases but don't exist in source-json. For each:
- Open `war/source-json/space-marine-codex-astartes.json`
- Find the corresponding profile in the original smCodexAstartes.js statlines and add it to the `profiles[]` array in source-json
- Re-run the translate script

Repeat until `grep MISSING` returns empty.

- [ ] **Step 5: Paste the translated aliases into the new smCodexAstartes.js and save**

Replace the `aliases: { ... }` placeholder in the file from Step 3 with the contents of `/tmp/sm-aliases.txt`.

- [ ] **Step 6: Delete the one-off script**

```
rm tools/translate-name-to-key.js
```

- [ ] **Step 7: Commit**

```
git add war/js/unitProfiles.smCodexAstartes.js war/source-json/space-marine-codex-astartes.json
git commit -m "migrate(smCodexAstartes): STATIC → shared loader, source-json is sole truth"
```

---

## Task 14: Browser verify smCodexAstartes — VALIDATION GATE

**Files:** none modified

This is the most important verification in the plan. Failure here means the source-json is missing or wrong data relative to what the static JS file shipped; the migration must not proceed until this gate passes.

- [ ] **Step 1: Start the local server**

```
cd war && python3 -m http.server 8000
```

- [ ] **Step 2: Reload chooser with SM_codex_NETEA and compare against Task 13 baseline screenshots**

Open `http://localhost:8000/chooser.html?list=SM_codex_NETEA`. Reproduce the same army you screenshotted in Task 13 Step 1. For each formation, view the unit cards. Compare each card against its baseline screenshot.

Expected: every card renders identically (same name, type, speed, armour, cc, ff, weapons, abilities).

If ANY card differs:
- Take note of what differs (e.g. "Tactical Marines: armour was 4+ in old JS, source-json says 4+/MW")
- Decide whether the source-json or the static JS file was correct (usually the source-json wins because it's traceable to the rulebook; consult `space-marine-codex-astartes.audit.md` if uncertain)
- Either correct source-json (if static JS was wrong) or correct the migration (if old static JS had a custom override that needs preserving as an alias)
- Re-run the smoke test until parity

- [ ] **Step 3: Verify the formation-extras logic if present**

Check whether the smCodexAstartes flow today uses any `*AdditionalProfilesForFormation` (it doesn't — that's in chooser.js for some other factions like blood angels, not smCodex). Confirm with:
```
grep -n "smCodexAstartesAdditionalProfilesForFormation\|smCodexAdditionalProfilesForFormation" war/js/chooser.js
```
Expected: no matches. Move on.

- [ ] **Step 4: Stop the server**

Ctrl+C.

- [ ] **Step 5: Commit verification milestone**

```
git commit --allow-empty -m "verify: SM_codex_NETEA renders identically after STATIC → loader migration"
```

If the migration required source-json edits in Step 2 above, those should already be in Task 13's commit (or amended into the SM_codex migration commit). The validation milestone signals that the static→loader pattern works and the bulk migration can proceed.

---

## Task 15: Build inventory script — STATIC files mapped to source-json

**Files:**
- Create: `tools/inventory-factions.js`

- [ ] **Step 1: Create the inventory script**

```js
// tools/inventory-factions.js
// Lists which war/js/unitProfiles.*.js files have a corresponding war/source-json/*.json file.
// Output goes to stdout: one line per faction, marked OK / MISSING / DYNAMIC.

'use strict';

const fs = require('fs');
const path = require('path');

const jsDir = path.resolve(__dirname, '..', 'war', 'js');
const srcDir = path.resolve(__dirname, '..', 'war', 'source-json');

const jsFiles = fs.readdirSync(jsDir)
    .filter(f => f.startsWith('unitProfiles.') && f.endsWith('.js'))
    .sort();

const srcFiles = new Set(fs.readdirSync(srcDir)
    .filter(f => f.endsWith('.json') && !f.includes('-v3.1-')));

function jsToSourceCandidates(jsName) {
    // unitProfiles.smCodexAstartes.js → space-marine-codex-astartes.json (informed guess)
    // The header comment is the truthful source; this is the fallback.
    const ns = jsName.replace(/^unitProfiles\./, '').replace(/\.js$/, '');
    // Convert camelCase to kebab-case.
    const kebab = ns.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return [kebab + '.json', kebab.replace('sm-', 'space-marine-') + '.json'];
}

function readHeaderSource(jsFile) {
    const head = fs.readFileSync(path.join(jsDir, jsFile), 'utf8').split('\n').slice(0, 10);
    for (const line of head) {
        // // Source: war/source-json/xyz.json
        const m = line.match(/Source:\s*(?:war\/)?source-json\/([\w-]+\.json)/);
        if (m) return m[1];
    }
    return null;
}

function isDynamic(jsFile) {
    const body = fs.readFileSync(path.join(jsDir, jsFile), 'utf8');
    return /Ajax\.Request|new\s+XMLHttpRequest|fetch\(/.test(body);
}

function usesLoader(jsFile) {
    const body = fs.readFileSync(path.join(jsDir, jsFile), 'utf8');
    return /ArmyforgeUnitProfiles\.registerFaction\s*\(/.test(body);
}

for (const f of jsFiles) {
    const sourceFromHeader = readHeaderSource(f);
    let sourceFile = sourceFromHeader;
    if (!sourceFile) {
        for (const candidate of jsToSourceCandidates(f)) {
            if (srcFiles.has(candidate)) { sourceFile = candidate; break; }
        }
    }
    const ok = sourceFile && srcFiles.has(sourceFile);
    const status = usesLoader(f) ? 'MIGRATED' :
                   isDynamic(f) ? 'DYNAMIC' :
                   ok ? 'STATIC-OK' : 'STATIC-NO-SOURCE';
    console.log(`${status}\t${f}\t${sourceFile || '(none)'}`);
}
```

- [ ] **Step 2: Run the script**

```
node tools/inventory-factions.js
```

Expected output: ~50 lines, each tagged `MIGRATED` (deathGuard + smCodexAstartes from Tasks 11-13), `DYNAMIC` (5 remaining: exploratorFleet, hedonicCrusade, thousandSons, traitorTitanLegions, vraksianTraitors), `STATIC-OK` (42-ish), or `STATIC-NO-SOURCE` (potentially a few — these are the ones that need source-json before migration).

- [ ] **Step 3: Save the inventory output for reference**

```
node tools/inventory-factions.js > /tmp/faction-inventory.txt
cat /tmp/faction-inventory.txt
```

Eyeball it. Note any `STATIC-NO-SOURCE` rows — these factions either need source-json authored OR they get skipped from the bulk migration. Document the decision in the commit message.

- [ ] **Step 4: Commit**

```
git add tools/inventory-factions.js
git commit -m "tool: add faction-inventory script to map JS files → source-json"
```

---

## Task 16: Bulk refactor remaining 5 DYNAMIC files

**Files:**
- Modify: `war/js/unitProfiles.exploratorFleet.js`
- Modify: `war/js/unitProfiles.hedonicCrusade.js`
- Modify: `war/js/unitProfiles.thousandSons.js`
- Modify: `war/js/unitProfiles.traitorTitanLegions.js`
- Modify: `war/js/unitProfiles.vraksianTraitors.js`

Each file follows the same pattern as Task 11 (deathGuard). The refactor is mechanical: delete the copy-pasted plumbing, wrap normalizer + aliases in a `registerFaction(...)` call, keep any per-faction extras logic.

- [ ] **Step 1: Refactor exploratorFleet.js**

Read `war/js/unitProfiles.exploratorFleet.js` and identify:
- Normalizer function name and body
- Aliases (whether they live in an `aliases` literal or a `nameToKey` table)
- armyIds (look for the `armyIds` literal in the original)
- The findExploratorFleetProfileByName function name (just confirm — should follow the pattern)
- Source-json path (from the header comment)
- Any *AdditionalProfilesForFormation function (preserve verbatim if present)

Rewrite using the same structure as Task 11's deathGuard rewrite. Run the local server, load `AMTL_MarsPrime_NETEA` (the armyId from `chooser.js:275`), verify unit cards render.

Commit:
```
git add war/js/unitProfiles.exploratorFleet.js
git commit -m "refactor(exploratorFleet): use shared unitProfileLoader"
```

- [ ] **Step 2: Refactor hedonicCrusade.js**

Same pattern. Verify with armyId `CHAOS_House_Devine_NETEA`. Commit.

- [ ] **Step 3: Refactor thousandSons.js**

Same pattern. Verify with armyId `CHAOS_ts_NETEA`. Commit.

- [ ] **Step 4: Refactor traitorTitanLegions.js**

Same pattern. Verify with armyId `CHAOS_titans_NETEA`. Commit.

- [ ] **Step 5: Refactor vraksianTraitors.js**

Same pattern. Verify with armyId `CHAOS_VraksianTraitors_NETEA`. Commit.

- [ ] **Step 6: Re-run the inventory**

```
node tools/inventory-factions.js | grep -c MIGRATED
```

Expected: 7 (deathGuard, smCodexAstartes, plus the 5 from this task).

---

## Task 17: Bulk migrate remaining STATIC files

**Files:**
- Modify: all remaining `war/js/unitProfiles.*.js` files marked `STATIC-OK` in the inventory.

These migrations follow the smCodexAstartes pattern (Task 13). Each file:
1. Has a hardcoded `profiles: {...}` literal — delete it
2. Has a `nameToKey: {...}` table — translate to the `aliases` shape using the same approach as Task 13 Step 3
3. Has a `normalize<X>ListName` (or similar) function — preserve verbatim
4. Has a header comment with the source-json path — use it as `sourceJsonPaths`

- [ ] **Step 1: Run the inventory to get the STATIC-OK list**

```
node tools/inventory-factions.js | grep STATIC-OK | awk '{print $2}' > /tmp/statics-to-migrate.txt
cat /tmp/statics-to-migrate.txt
wc -l /tmp/statics-to-migrate.txt
```

Expected: ~41 entries (50 JS files - 7 migrated - 1 eldarCraftworlds multi-source - 0 to N STATIC-NO-SOURCE).

- [ ] **Step 2: For each entry in /tmp/statics-to-migrate.txt, repeat the Task 13 procedure**

For each `unitProfiles.<faction>.js` in the list:

a. Run a per-faction version of the translate script:
```js
// /tmp/translate.js (one-off, parametric)
const fs = require('fs');
const jsFile = process.argv[2];        // e.g. "war/js/unitProfiles.cadianShockTroops.js"
const sourceFile = process.argv[3];    // e.g. "war/source-json/cadian-shock-troops.json"

const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const keyToName = {};
for (const p of source.profiles || []) {
    if (!p.name) continue;
    const key = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    keyToName[key] = p.name;
}

// Extract the existing nameToKey from the JS file (regex; this is fragile but works
// for the canonical STATIC shape produced by smCodexAstartes-style files).
const body = fs.readFileSync(jsFile, 'utf8');
const nameToKeyMatch = body.match(/nameToKey:\s*\{([\s\S]*?)\}\s*\}/);
if (!nameToKeyMatch) {
    console.error('NO nameToKey BLOCK FOUND in ' + jsFile);
    process.exit(1);
}
// Each entry is 'foo':'bar' or "foo":"bar"; split on commas-not-in-quotes is non-trivial,
// so use a stricter line-oriented regex:
const entryRe = /'([^']+)'\s*:\s*'([^']+)'|"([^"]+)"\s*:\s*"([^"]+)"/g;
let m;
const out = [];
while ((m = entryRe.exec(nameToKeyMatch[1])) !== null) {
    const alias = m[1] || m[3];
    const snakeKey = m[2] || m[4];
    const target = keyToName[snakeKey];
    if (!target) {
        out.push(`\t\t// MISSING source-json profile for snake_key=${snakeKey}, alias="${alias}"`);
    } else {
        const niceAlias = alias.charAt(0).toUpperCase() + alias.slice(1);
        out.push(`\t\t${JSON.stringify(niceAlias)}: ${JSON.stringify(target)},`);
    }
}
console.log(out.join('\n'));
```

Run:
```
node /tmp/translate.js war/js/unitProfiles.<faction>.js war/source-json/<faction>.json > /tmp/<faction>-aliases.txt
grep MISSING /tmp/<faction>-aliases.txt
```

If MISSING markers appear: edit the source-json to add the missing profiles (using the original JS file's statlines as the source of truth), then re-run the translate script.

b. Rewrite the JS file following the smCodexAstartes shape. Use the translated aliases.

c. Commit:
```
git add war/js/unitProfiles.<faction>.js [war/source-json/<faction>.json if edited]
git commit -m "migrate(<faction>): STATIC → shared loader"
```

d. Browser smoke check: open the corresponding armyId in chooser, click 2-3 formations, confirm unit cards render. Find the armyId by grepping `war/js/chooser.js` for the faction's finder function:
```
grep -n "find<Faction>ProfileByName" war/js/chooser.js
```

- [ ] **Step 3: Halfway checkpoint — full smoke test**

After roughly 20 factions are migrated, do a broader browser pass: pick 4-5 random migrated factions across game systems (a NETEA Space Marine chapter, an IG list, an Eldar list isn't in scope yet, an Ork list, a Tyranid list) and confirm they all render. This is the moment to catch any systemic loader bug before the remaining 20+ factions ship.

- [ ] **Step 4: Continue until all STATIC-OK files are migrated**

Run inventory again:
```
node tools/inventory-factions.js | grep -v MIGRATED
```

Expected: only DYNAMIC entries from Task 16 (already migrated; the inventory script's MIGRATED detection only checks for `registerFaction` so they should be MIGRATED — if any of them still shows DYNAMIC, the refactor in Task 16 was incomplete), one eldarCraftworlds (to be done in Task 18), and possibly a few `STATIC-NO-SOURCE` entries that were deferred. No `STATIC-OK` entries should remain.

- [ ] **Step 5: Delete the one-off translate script**

```
rm /tmp/translate.js
```

- [ ] **Step 6: Commit a milestone**

```
git commit --allow-empty -m "milestone: bulk STATIC migration complete"
```

---

## Task 18: Migrate eldarCraftworlds (multi-source)

**Files:**
- Modify: `war/js/unitProfiles.eldarCraftworlds.js`

This file covers four source-json files (eldar-alaitoc, eldar-biel-tan, eldar-iyanden, eldar-saim-hann) under a single namespace and finder. The shared loader supports this via an array of paths in `sourceJsonPaths`.

- [ ] **Step 1: Read eldarCraftworlds.js to identify the four armyIds and the multi-source shape**

```
head -20 war/js/unitProfiles.eldarCraftworlds.js
```

Expected armyIds: `EL_alaitoc_NETEA`, `EL_bieltan_NETEA`, `EL_iyanden_NETEA`, `EL_saimhann_NETEA`. Source-json paths follow the same kebab convention.

- [ ] **Step 2: Rewrite the file**

Replace the file with:

```js
// Source: war/source-json/eldar-alaitoc.json
// Source: war/source-json/eldar-biel-tan.json
// Source: war/source-json/eldar-iyanden.json
// Source: war/source-json/eldar-saim-hann.json
// Values extracted from those pages; manually verify against the source if any ambiguity remains.

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeEldarCraftworldName = ArmyforgeUnitProfiles.normalizeEldarCraftworldName || function(displayName) {
	// PRESERVE the existing normalizer if one exists in the original; otherwise use a sane default.
	if (!displayName) return '';
	return String(displayName).toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'eldarCraftworlds',
	findFunctionName: 'findEldarCraftworldProfileByName',
	armyIds: ['EL_alaitoc_NETEA', 'EL_bieltan_NETEA', 'EL_iyanden_NETEA', 'EL_saimhann_NETEA'],
	sourceJsonPaths: [
		'./source-json/eldar-alaitoc.json',
		'./source-json/eldar-biel-tan.json',
		'./source-json/eldar-iyanden.json',
		'./source-json/eldar-saim-hann.json'
	],
	normalizer: ArmyforgeUnitProfiles.normalizeEldarCraftworldName,
	aliases: {
		// Translate the original profiles' display names into the aliases shape
		// using the same approach as Task 13 (translate-name-to-key script).
		// Since the four source-jsons may have overlapping profile names
		// (e.g. all four define "Guardians"), the loader's last-write-wins
		// behavior will leave the last-loaded source as the canonical statline.
		// If chapter-specific stats matter, that's a content question to resolve
		// in source-json, not loader logic.
	}
});
```

For the aliases translation, run the Task 13 translate approach but iterate over all four source-jsons to build the union of profile names.

- [ ] **Step 3: Run the translate script for eldarCraftworlds**

Adapt the one-off translator to read multiple source files. Place the union of profiles in `keyToName`. Then translate the original `eldarCraftworlds.js` nameToKey table into the aliases shape.

- [ ] **Step 4: Browser-verify all four list IDs**

```
cd war && python3 -m http.server 8000
```

Open in turn:
- `http://localhost:8000/chooser.html?list=EL_alaitoc_NETEA`
- `http://localhost:8000/chooser.html?list=EL_bieltan_NETEA`
- `http://localhost:8000/chooser.html?list=EL_iyanden_NETEA`
- `http://localhost:8000/chooser.html?list=EL_saimhann_NETEA`

For each, build a small army, confirm unit cards render. Pay particular attention to any chapter-specific entries (e.g. Iyanden Wraithguard) — if these differ across the four sources, the last-write-wins behavior will pick one statline. If that's wrong for some chapters, the source-json files need reconciliation (out of scope) and the migration may need to defer the affected list IDs.

Ctrl+C to stop the server.

- [ ] **Step 5: Commit**

```
git add war/js/unitProfiles.eldarCraftworlds.js
git commit -m "migrate(eldarCraftworlds): multi-source shared loader (4 source-jsons)"
```

---

## Task 19: Document the new pattern

**Files:**
- Create: `war/js/unitProfileLoader.md`

- [ ] **Step 1: Write the README**

```markdown
# unitProfileLoader.js

Shared loader for `unitProfiles.<faction>.js` files. Loaded once by `chooser.html` before any faction script.

## Adding a new faction

Create `war/js/unitProfiles.<camelCaseFaction>.js`:

```js
// Source: war/source-json/<kebab-faction>.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalize<Faction>Name = function(displayName) {
    if (!displayName) return '';
    return String(displayName).toLowerCase()
        // ... faction-specific replacements (chapter names, transport phrases, etc.)
        .replace(/\s+/g, ' ').trim();
};

ArmyforgeUnitProfiles.registerFaction({
    namespace: '<camelCaseFaction>',
    findFunctionName: 'find<Faction>ProfileByName',
    armyIds: ['<LIST_ID>'],                          // matches chooser.js:260-315
    sourceJsonPaths: ['./source-json/<kebab>.json'], // array — supports multi-source
    normalizer: ArmyforgeUnitProfiles.normalize<Faction>Name,
    aliases: {
        'Free-Text Display Name': 'Canonical Profile Name'
        // alias keys are what lists/*.json or the UI passes in;
        // alias values are the profile.name strings from source-json.
    }
});

// Optional per-faction extras (formation → extra cards)
ArmyforgeUnitProfiles.<camelCaseFaction>AdditionalProfilesForFormation = function(formation) {
    // ...
};
```

Then add a `<script>` tag to `chooser.html` after the loader tag.

## Adding to chooser.js

Register the faction in `chooser.js:profileFindersByListId` (around line 260):

```js
'<LIST_ID>': ArmyforgeUnitProfiles.find<Faction>ProfileByName,
```

## Loading flow

1. Browser loads `unitProfileLoader.js` → defines `ArmyforgeUnitProfiles.registerFaction`.
2. Browser loads each `unitProfiles.<faction>.js` → each calls `registerFaction(...)` synchronously.
3. `registerFaction` synchronously fetches each `sourceJsonPaths` entry via Prototype.js `Ajax.Request` (`asynchronous: false`), merges all profiles, registers under `ArmyforgeUnitProfiles[namespace]`, and attaches `ArmyforgeUnitProfiles[findFunctionName]`.
4. Synchronous Ajax blocks page load briefly. Known limitation; see open issues in the spec.

## Testing

Pure helpers (`cloneProfile`, `deriveKey`, `registerAlias`, `buildFinder`) have unit tests under `tools/test/loader.test.js`:

```
node --test tools/test/loader.test.js
```

The Ajax loading is browser-only; verify via the local dev server:

```
cd war && python3 -m http.server 8000
# then open http://localhost:8000/chooser.html?list=<LIST_ID>
```

## Invariants

- `findFunctionName` MUST match the name used in `chooser.js:profileFindersByListId`. Renaming requires a `chooser.js` edit.
- `armyIds` MUST contain every list ID that routes to this faction.
- `aliases` values MUST be profile names that appear in at least one source-json's `profiles[]`. Missing targets become unresolvable.
- Source-json profiles with `is_reference_or_ambiguous: true` are NOT filtered by the loader — they appear as full profiles. If a "reference card" entry needs special treatment, handle it in the faction file (e.g. by not aliasing to it) or omit it from source-json.
```

- [ ] **Step 2: Commit**

```
git add war/js/unitProfileLoader.md
git commit -m "docs: explain registerFaction API and migration shape for faction files"
```

---

## Final verification

After all tasks complete:

- [ ] **Step 1: Re-run the inventory and confirm full migration**

```
node tools/inventory-factions.js
```

Expected: every entry is `MIGRATED` except any `STATIC-NO-SOURCE` that were intentionally deferred.

- [ ] **Step 2: Re-run unit tests**

```
node --test tools/test/loader.test.js
```

Expected: all pass.

- [ ] **Step 3: Full browser smoke test**

```
cd war && python3 -m http.server 8000
```

Pick 8-10 list IDs across game systems (CHAOS, IG, ELDAR, ORK, NECRON, TAU, SPACE_MARINE) and verify each renders unit cards correctly.

- [ ] **Step 4: Confirm commit history is clean**

```
git log --oneline master..HEAD
```

Expected: a clear progression of `feat`, `refactor`, `migrate`, `verify`, `docs` commits — one per task — that could be reviewed in order.
