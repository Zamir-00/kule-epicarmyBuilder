# Unit-Profile Shared Loader

**Status:** Design — pending implementation
**Date:** 2026-05-26 (revised after structural survey)
**Owner:** mirza.sahinkaya@efsora.com

## Revision note

This spec originally proposed a build-time codegen tool that would emit `war/js/unitProfiles.*.js` from `war/source-json/*.json` + per-faction sidecars. A pre-implementation survey of the 50 existing unitProfile files revealed three structural shapes, not one:

- 43 **STATIC** files with hardcoded profile literals (e.g. `unitProfiles.smCodexAstartes.js`)
- 6 **DYNAMIC** files that already load source-json at runtime via Prototype.js `Ajax.Request` (e.g. `unitProfiles.deathGuard.js`) — these were the most recent additions and they already solve the drift problem differently
- 1 **multi-source** file (`unitProfiles.eldarCraftworlds.js`) that covers four source-json files under a single namespace

Given that 6 files already prove the runtime-loader pattern works in production, the design pivots to **standardizing what works** rather than introducing build-time codegen. The shared-loader approach is smaller (no build step, no codegen, no sidecars, no extractor), aligns with the direction the recent commits were already heading, and reduces the migration surface area from "every file changes" to "every file changes in a uniform way that's already established."

The earlier codegen direction is preserved in git history (commit `21c607d`) for reference.

## Background

The repo carries three parallel data layers for army-list content:

1. `war/source-json/*.json` — scraped from `tp.net-armageddon.org/army-lists/...`. Authoritative source. 56 files.
2. `war/js/unitProfiles.*.js` — UI unit-card statlines plus per-faction normalizer regexes, alias tables, finder functions, and (for some factions) formation-extras logic. Loaded by `war/js/chooser.js` and indexed via the `profileFindersByListId` switch at `chooser.js:260-315`. 50 files.
3. `war/lists/*.json` — the actual army-builder data (formations, point costs, upgrades). References units by free-text names which the JS layer resolves via the alias tables. 157 files.

Layer 2 today contains 6 files that fetch their data from layer 1 at runtime (mostly drift-free) and 43 files that hardcode their data inline (drift-prone — `war/source-json/*.audit.md` exists to babysit). All 6 dynamic files share heavy copy-paste: each duplicates a synchronous `Ajax.Request` loader, a `cloneProfile` helper, a `registerAlias` helper, and an identical-shape `find<Faction>ProfileByName` function.

The user's stated goal: stop hand-translating, eliminate the drift class.

## Goals

- Extract the shared mechanical bits (sync Ajax load, profile cloning, alias registration, finder construction) into a single `war/js/unitProfileLoader.js` library.
- Each `war/js/unitProfiles.<faction>.js` becomes ~40-100 lines: a per-faction normalizer regex, an aliases object literal, a `registerFaction(...)` call into the shared loader, and optionally a per-faction `<faction>AdditionalProfilesForFormation` function. No copy-pasted plumbing.
- Migrate the 43 STATIC files to this shape: source-json becomes their single source of truth at runtime; the hardcoded profile literals get deleted.
- Refactor the 6 existing DYNAMIC files to use the shared loader instead of their inline copy-paste.
- Migrate `unitProfiles.eldarCraftworlds.js` by extending the shared loader to merge profiles from N source-jsons in a single registration.

## Non-goals

- No changes to `chooser.js`'s `profileFindersByListId` switch at lines 260-315. The function names that switch references (`find<Faction>ProfileByName`) must continue to exist with the same names.
- No changes to `ArmyList.js`, `Force.js`, or any `war/lists/*.json` file.
- No changes to the source-json shape itself. Loader handles existing fields (`abilities_or_notes`, `(base contact)` parens, etc.).
- No relocation of the existing per-faction `*AdditionalProfilesForFormation` functions. 5 live inline in dynamic files and stay there; ~5+ live inside `chooser.js` (at lines 645, 681, 763, 900, 1077, …) and stay there. A future spec can consolidate them.
- No new build pipeline, no `package.json`, no test framework adoption. The shared loader is loaded by a `<script>` tag like every other JS file in `war/js/`.
- No conversion from synchronous to asynchronous loading. The 6 working DYNAMIC files use `Ajax.Request` with `asynchronous: false`; the shared loader keeps that. A future modernization can move to async + `Promise.all`.
- No changes to which factions exist in the UI. The 5 source-jsons without an existing JS counterpart (55 source-json minus 50 JS, minus extra eldarCraftworlds coverage) are not wired in by this spec.

## Architecture

### New shared library

A single new file at `war/js/unitProfileLoader.js`. Loaded by every `index<RULESET>.html` page before any `unitProfiles.<faction>.js`. Provides one public API:

```js
ArmyforgeUnitProfiles.registerFaction({
    namespace: 'deathGuard',
    findFunctionName: 'findDeathGuardProfileByName',
    armyIds: ['CHAOS_dg_NETEA'],
    sourceJsonPaths: ['./source-json/death-guard.json'],
    normalizer: ArmyforgeUnitProfiles.normalizeDeathGuardName,
    aliases: {
        '1+ Plague Marine Retinue': 'Plague Marines',
        'Plague Marine Retinue': 'Plague Marines',
        // ... ~80 entries
    }
});
```

What `registerFaction` does internally:

1. For each path in `sourceJsonPaths`: synchronous `Ajax.Request` (matching the existing DYNAMIC files), JSON parse. Failures are logged via `console.warn` and the path is skipped (matches current DYNAMIC behavior — robustness against missing files during local dev).
2. Merge all resulting `profiles[]` arrays into one list.
3. For each merged profile: derive a snake_case key via `normalizer(profile.name).replace(/\s+/g, '_')`, clone the profile (normalize `abilities_or_notes`→`abilities`, deep-copy weapons), store in `ArmyforgeUnitProfiles[namespace].profiles[key]`, and register the profile's own name as a self-alias.
4. For each entry in `aliases`: normalize the key (free-text), look up the target name's snake_case key, and store the mapping in `ArmyforgeUnitProfiles[namespace].nameToKey`. Also store a compact-no-spaces variant for resilience.
5. Attach `ArmyforgeUnitProfiles[findFunctionName] = function(displayName, listId) { ... }` — body identical across all factions, parameterized only on `namespace` and `normalizer`.

The loader's three internal helpers (`loadSourceJsonSync`, `cloneProfile`, `registerAlias`) are private to the file. They are the exact functions copy-pasted across today's 6 DYNAMIC files, moved once.

### Per-faction file shape, post-migration

```js
// Source: war/source-json/death-guard.json
var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeDeathGuardName = function(displayName) {
    if (!displayName) return '';
    return String(displayName).toLowerCase()
        .replace(/<[^>]*>/g, ' ')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[''']/g, '')
        // ... faction-specific replacements
        .strip();
};

ArmyforgeUnitProfiles.registerFaction({
    namespace: 'deathGuard',
    findFunctionName: 'findDeathGuardProfileByName',
    armyIds: ['CHAOS_dg_NETEA'],
    sourceJsonPaths: ['./source-json/death-guard.json'],
    normalizer: ArmyforgeUnitProfiles.normalizeDeathGuardName,
    aliases: {
        // ~80 entries
    }
});

// Formation-extras (only on factions that have it; stays inline)
ArmyforgeUnitProfiles.deathGuardAdditionalProfilesForFormation = function(formation) {
    // unchanged from today
};
```

Compared to today's DYNAMIC files (~410 lines for deathGuard.js), the post-migration shape is ~150 lines for deathGuard (a normalizer + aliases + registration + extras logic). The ~80 lines of copy-pasted loader/clone/alias-register machinery are gone.

Compared to today's STATIC files (~150 lines for smCodexAstartes.js, but with hardcoded profile literals), the post-migration shape is ~30-40 lines (no statline data; that lives in source-json).

### Multi-source factions

For `unitProfiles.eldarCraftworlds.js`, which today merges four sub-faction profiles into one namespace:

```js
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
    // ...
});
```

The loader merges profiles from all four sources. Key collisions (two source-jsons defining the same profile name) are resolved last-write-wins, matching today's behavior; a `console.warn` flags any collision so the operator notices.

### Loader API contract

```
registerFaction(config) → void

config: {
    namespace: string                                  // required, ArmyforgeUnitProfiles[namespace] key
    findFunctionName: string                            // required, must match chooser.js:260-315 references
    armyIds: string[]                                   // required, list-ids that route to this faction
    sourceJsonPaths: string[]                           // required, relative paths from war/ (e.g. './source-json/x.json')
    normalizer: (string) => string                      // required, faction-specific name normalizer
    aliases: { [freeText: string]: string }             // required, may be empty {}, free-text → canonical-profile-name
}
```

Side effects:
- Sets `ArmyforgeUnitProfiles[namespace] = { armyIds, profiles: {key: profile}, nameToKey: {normalized: key} }`
- Sets `ArmyforgeUnitProfiles[findFunctionName] = (displayName, listId) => profile | null`

The `<faction>AdditionalProfilesForFormation` functions, where they exist, remain attached directly to `ArmyforgeUnitProfiles` by each faction file — they are not part of the loader API.

## Loader behavior details

### Sync Ajax wrapper

Same shape as today's copy-pasted `loadSourceData()`:

```js
function loadSourceJsonSync(path) {
    var responseText = null;
    try {
        new Ajax.Request(path, {
            method: 'get',
            asynchronous: false,
            onSuccess: function(response) { responseText = response.responseText; }
        });
    } catch (err) {
        console.warn('unitProfileLoader: Ajax error for ' + path, err);
        return null;
    }
    if (!responseText) {
        console.warn('unitProfileLoader: empty response for ' + path);
        return null;
    }
    try {
        return JSON.parse(responseText);
    } catch (err2) {
        console.warn('unitProfileLoader: JSON parse error for ' + path, err2);
        return null;
    }
}
```

Returning null on any failure (rather than throwing) preserves today's behavior — factions that fail to load show no profiles rather than breaking the whole page. Affected lists will show no unit cards but the army-builder UI still works.

### Profile cloning

Same shape as today's `cloneProfile`:

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

The `abilities_or_notes || abilities` fallback handles both source-json (uses `abilities_or_notes`) and existing JS literals (uses `abilities`) without separate code paths. Source-json fields like `parse_confidence`, `source_section`, etc. are dropped by not being copied.

### Finder body (parameterized)

Emitted once by the loader per registration:

```js
ArmyforgeUnitProfiles[config.findFunctionName] = function(displayName, listId) {
    if (!displayName) return null;
    if (listId && !ArmyforgeUnitProfiles[config.namespace].armyIds.member(listId)) return null;
    var normalized = config.normalizer(displayName);
    var faction = ArmyforgeUnitProfiles[config.namespace];
    var key = faction.nameToKey[normalized] || faction.nameToKey[normalized.replace(/\s+/g, '')];
    if (!key) return null;
    return faction.profiles[key] || null;
};
```

This body is byte-identical across the 6 existing DYNAMIC files (see `unitProfiles.deathGuard.js:208-221`). Centralizing it removes another copy-paste class.

### Alias registration

```js
function registerAlias(namespace, normalizer, alias, key) {
    if (!alias || !key) return;
    var normalized = normalizer(alias);
    if (!normalized) return;
    ArmyforgeUnitProfiles[namespace].nameToKey[normalized] = key;
    var compact = normalized.replace(/\s+/g, '');
    if (compact) ArmyforgeUnitProfiles[namespace].nameToKey[compact] = key;
}
```

Same logic as today's inline `registerAlias` in `unitProfiles.deathGuard.js:41-54`. The compact-variant entry handles cases where the input has irregular whitespace.

### Profile registration loop

After loading & merging source-json profiles, the loader runs this for each:

```js
profiles.forEach(function(profile) {
    var key = config.normalizer(profile.name).replace(/\s+/g, '_');
    if (!key) return;
    if (ArmyforgeUnitProfiles[config.namespace].profiles[key]) {
        console.warn('unitProfileLoader: profile key collision for ' + key +
                     ' (source: ' + config.namespace + ')');
    }
    ArmyforgeUnitProfiles[config.namespace].profiles[key] = cloneProfile(profile);
    registerAlias(config.namespace, config.normalizer, profile.name, key);
});
```

Then it iterates over `config.aliases` and registers each entry the same way (resolving alias-target → key first via the same normalize+key derivation).

## HTML loading order

Only `war/chooser.html` loads `unitProfiles.*.js` script tags (49 of them, starting at line 11). The other index HTML files (`indexNETEA.html`, `indexEPICUK.html`, etc.) do not — they redirect into or frame `chooser.html`. Confirmed by `grep`.

The new `unitProfileLoader.js` script tag must be added to `chooser.html` once, positioned *before* the first `unitProfiles.*.js` tag. One file, one edit.

## Migration plan

Seven steps, each independently revertable. Estimated total effort: 4-6 hours of focused work, plus another 4-8 hours of bulk migration and browser verification.

**Step 1 — Land the loader, zero behavior change.**
Add `war/js/unitProfileLoader.js` with the API above. Add a `<script>` tag for it to every index HTML file, *before* any `unitProfiles.*.js` tag. Smoke test: open `war/indexNETEA.html`, load a STATIC faction list (e.g. SM_codex_NETEA) and a DYNAMIC faction list (e.g. CHAOS_dg_NETEA), confirm both still work — the loader is loaded but unused so nothing should change.

**Step 2 — Pilot one DYNAMIC migration.**
Refactor `unitProfiles.deathGuard.js` to use `registerFaction(...)` instead of its inline IIFE. Delete the inline `loadSourceData`, `cloneProfile`, `registerAlias`, IIFE, and the `findDeathGuardProfileByName` definition. Keep the normalizer, aliases, and `deathGuardAdditionalProfilesForFormation`. Browser-verify CHAOS_dg_NETEA renders identically.

**Step 3 — Pilot one STATIC migration.**
Pick `unitProfiles.smCodexAstartes.js` (most-used, largest profile count). Delete the hardcoded `profiles: {...}` literal. Replace with a `registerFaction(...)` call pointing at `./source-json/space-marine-codex-astartes.json`. Keep the existing `nameToKey` entries as the `aliases` map. Browser-verify SM_codex_NETEA list renders correctly *and* shows the same statlines as before (diff the visible cards against a screenshot from before the migration). This is the validation gate; any drift surfaced here is real drift that the spec exists to expose.

**Step 4 — Bulk refactor the remaining 5 DYNAMIC files.**
Same pattern as Step 2 applied to exploratorFleet, hedonicCrusade, thousandSons, traitorTitanLegions, vraksianTraitors. Each is mechanical: delete the copy-pasted plumbing, wrap the existing aliases in a `registerFaction(...)` call. Spot-check 2 of the 5 in the browser.

**Step 5 — Bulk migrate the remaining 42 STATIC files.**
For each: confirm a corresponding source-json exists (script: list which JS namespaces lack a source-json), delete the inline `profiles: {...}` literal, convert the existing `nameToKey` entries into an `aliases` map, wrap in a `registerFaction(...)` call. Any faction whose source-json doesn't exist gets skipped and listed for a follow-up. Spot-check 4-5 factions in the browser across different rulesets.

**Step 6 — Migrate eldarCraftworlds (multi-source).**
Same as Step 5 but with 4 entries in `sourceJsonPaths`. Verify all four list IDs (EL_alaitoc, EL_bieltan, EL_iyanden, EL_saimhann) render correctly.

**Step 7 — Lock it down.**
Add `tools/README.md` (or `war/js/unitProfileLoader.md`) documenting the new pattern and what each faction file should look like. Optional: write a small `tools/check-faction-shape.js` linter that scans `war/js/unitProfiles.*.js` and warns if any file still contains the legacy patterns (hardcoded `profiles: {...}` literal, inline `Ajax.Request`, inline `cloneProfile`). Not required to ship.

### Rollback strategy

Each step is one commit, revertable independently. Step 3 (STATIC pilot) is the riskiest — a failure means the migrated faction shows wrong/missing cards in the browser. Rollback: revert the commit, investigate the drift (almost certainly a source-json field that the loader doesn't handle, or an alias mismatch), fix in the loader OR in the source-json, retry. The pilot exists precisely to surface these before they hit 42 files.

### Validation gate

At Step 3, before committing, the operator MUST open `war/indexNETEA.html` in a real browser, load a SM_codex_NETEA list, and compare unit-card rendering to a pre-migration screenshot. Drift between the static profile data and the source-json data WILL exist for some factions (that is the original problem); the validation step's job is to make that drift visible and resolved before the bulk migration. No claiming success without this step.

## Open issues

- **Faction JS files with non-canonical normalizer/alias shapes.** Some of the 43 STATIC files may have custom logic that doesn't cleanly fit a `{normalizer, aliases}` pair. Known after attempting Step 5 on each. Failure mode: skip the file, list for follow-up.
- **STATIC files with no corresponding source-json.** A script in Step 5 will identify these. Likely action: leave them as-is or open follow-up tickets to scrape/author their source-json. Out of scope.
- **Synchronous Ajax deprecation.** Modern browsers print a console warning for `XMLHttpRequest` with `async=false`. The pattern still works but is on the deprecation track. A future spec can switch to async + a global `Promise.all` boot phase that gates `chooser.js` initialization. Not addressed here.
- **Page-load performance.** Each faction file triggers a sync Ajax round-trip on page load. With 50 factions, that's 50 sequential requests. In practice, only the factions referenced by a loaded list-id's UI path matter — but the loader runs on every page load regardless. Worth measuring after Step 5. Mitigations (if needed): lazy-load on first finder call, or bundle all source-jsons into a single `all-source-data.json`. Out of scope unless measurement shows it matters.
- **Reference profiles.** Source-json marks some entries `is_reference_or_ambiguous: true` (e.g. UI-only entries like `spacecraft`, `ambush`, `planetfall` in the static space-marine file). Today's STATIC files include these as full profiles in their literals. The loader treats source-json entries uniformly — it loads them all. If a source-json doesn't include a reference profile that the static file did, that entry vanishes from the UI post-migration. Action: during Step 3 piloting, identify any vanished reference profiles and add them to source-json explicitly. Document this loss-of-fidelity check in the migration runbook.
