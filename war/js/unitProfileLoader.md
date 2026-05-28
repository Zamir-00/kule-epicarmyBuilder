# unitProfileLoader.js

Shared loader for `unitProfiles.<faction>.js` files. Loaded by `chooser.html` once, before any per-faction script.

This document explains:
- the `registerFaction(config)` API
- how to add a new faction
- how to update an existing faction's unit stats
- how to migrate a legacy STATIC faction file to use the loader
- testing and CI

---

## What the loader does

Before the loader existed, every `unitProfiles.<faction>.js` file was self-contained: it hardcoded all unit stats as a JS object literal, defined its own `nameToKey` map (display string -> snake_case key), and exported its own `findXxxProfileByName` function. That meant every faction file was ~400 lines of near-identical plumbing repeated 50 times. Changing anything structural — the lookup algorithm, how abilities are normalised, deep-copy semantics — required editing every file.

The loader centralises that plumbing. A faction file now just declares a config object and calls `ArmyforgeUnitProfiles.registerFaction(config)`. The loader fetches the faction's `source-json` file at page-load time via a synchronous Ajax request (Prototype.js `Ajax.Request`), builds the `profiles` map and `nameToKey` lookup table from the JSON, and attaches a finder function to `ArmyforgeUnitProfiles`. The per-faction JS file shrinks from ~400 lines to ~40-150 lines of config.

The codebase distinguishes two kinds of faction files: **DYNAMIC** files use `registerFaction` and read stats from `war/source-json/*.json` at runtime; **STATIC** files predate the loader and embed all stats directly as JS object literals. Seven factions have been migrated to DYNAMIC; the remaining ~40+ are still STATIC. Both shapes work today — `chooser.js` calls whichever finder is registered. The long-term direction is for all factions to become DYNAMIC as source-json coverage grows (see S1.4, S1.9 in `ROADMAP.md`).

---

## API: registerFaction(config)

```js
ArmyforgeUnitProfiles.registerFaction({
    namespace:        'myFaction',                         // required
    findFunctionName: 'findMyFactionProfileByName',        // required
    armyIds:          ['MY_faction_NETEA'],                // required
    sourceJsonPaths:  ['./source-json/my-faction.json'],   // required
    normalizer:       ArmyforgeUnitProfiles.normalizeMyFactionName,  // required
    aliases:          { 'Display Variant': 'Canonical Name' }        // optional
});
```

### Required config fields

| Field | Type | Description |
|---|---|---|
| `namespace` | string | Key under `ArmyforgeUnitProfiles` where faction data is stored. By convention: camelCase faction name, e.g. `deathGuard`, `smCodexAstartes`. |
| `findFunctionName` | string | Name of the finder function registered on `ArmyforgeUnitProfiles`. Must match the key used in `chooser.js`'s `profileFindersByListId` switch. |
| `armyIds` | string[] | List IDs (from `war/lists/`) that this faction services. The finder returns `null` for any `listId` not in this array. |
| `sourceJsonPaths` | string[] | Paths to source-json files, relative to `war/`. Typically one path; pass multiple for factions that share profiles across several files (e.g. Eldar Craftworlds: 4 files). |
| `normalizer` | function | `(displayName: string) => string` — strips noise from display strings so they match profile names. Write this before calling `registerFaction`; attach it to `ArmyforgeUnitProfiles` so it can be reused by formation helpers. |

### Optional config fields

| Field | Type | Default | Description |
|---|---|---|---|
| `aliases` | object | `{}` | Maps free-text display variants to canonical profile names (as they appear in `source-json`). Keys are the raw strings shown in the UI; values are the `name` field from the source-json profile — **not** the derived snake_case key. |

### Side effects

After `registerFaction` returns:

- `ArmyforgeUnitProfiles[namespace]` is set to `{ armyIds, profiles, nameToKey }`:
  - `profiles` — keyed by derived snake_case key, each value is a deep-cloned profile object with fields `name`, `type`, `speed`, `armour`, `cc`, `ff`, `weapons`, `abilities`.
  - `nameToKey` — maps normalised display strings (and their whitespace-stripped variants) to profile keys.
- `ArmyforgeUnitProfiles[findFunctionName]` is set to `function(displayName, listId)` — returns a cloned profile or `null`.

The loader is idempotent per `namespace`: if `registerFaction` is called again for the same namespace (e.g. during unit tests), it reuses the existing faction object and merges new profiles in.

---

## Recipe — Add a new faction

### Step 1: Author `war/source-json/<faction>.json`

The file must contain a `profiles` array. Every element needs at minimum a `name` field; the loader also reads `type`, `speed`, `armour`, `cc`, `ff`, `weapons`, and `abilities_or_notes` / `abilities`.

```json
{
    "$schema": "../../schemas/source-json.schema.json",
    "metadata": {
        "id": "my-faction",
        "name": "My Faction",
        "rulebook_url": "https://tp.net-armageddon.org/army-lists/my-faction.html"
    },
    "profiles": [
        {
            "name": "My Trooper",
            "type": "INF",
            "speed": "15cm",
            "armour": "5+",
            "cc": "5+",
            "ff": "5+",
            "weapons": [
                {
                    "name": "Bolter",
                    "range": "15cm",
                    "firepower": "Small Arms",
                    "notes": []
                }
            ],
            "abilities_or_notes": ["Reinforced Armour"]
        }
    ]
}
```

The schema is at `schemas/source-json.schema.json` (JSON Schema draft-07). Add `"$schema": "../../schemas/source-json.schema.json"` so your editor provides inline validation. See `docs/design/data-model.md` for the full field spec and the rationale behind raw-text vs structured-sibling fields.

The `formations` array in source-json is **informational only** — do not put authoritative army-list config there. Formation costs and upgrade lists belong in `war/lists/<faction>_<ruleset>.json`.

### Step 2: Create `war/js/unitProfiles.<faction>.js`

```js
// Source: war/source-json/my-faction.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeMyFactionName = ArmyforgeUnitProfiles.normalizeMyFactionName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/['']/g, '')
		// Strip the faction name prefix if the list shows it
		.replace(/\bmy faction\b/g, ' ')
		// Strip common noise words
		.replace(/\b(formation|formations|retinue|retinues|squadron|squadrons|of|the|a|an|and|or)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'myFaction',
	findFunctionName: 'findMyFactionProfileByName',
	armyIds: ['MY_faction_NETEA'],
	sourceJsonPaths: ['./source-json/my-faction.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeMyFactionName,
	aliases: {
		'My Troopers':  'My Trooper',
		'My Trooper':   'My Trooper'
	}
});
```

Notes on the normalizer:
- `.strip()` is Prototype.js's `String#strip` (trims whitespace); it is always available in the browser context.
- Strip the faction's own name from display strings if list entries are prefixed with it (e.g. `"Death Guard Rhino"` -> strip `"death guard"` -> `"rhino"`).
- Strip plural suffixes only via replacements, not a blanket `-s` drop, because that causes false matches.
- Use ASCII single/double quotes only. Smart quotes break JS parsing.

### Step 3: Add a `<script>` tag to `war/chooser.html`

Open `war/chooser.html`. Add your new script **after** the `unitProfileLoader.js` tag and before `chooser.js`:

```html
<script type="text/javascript" src="./js/unitProfileLoader.js"></script>
<!-- ... other faction files ... -->
<script type="text/javascript" src="./js/unitProfiles.myFaction.js"></script>
<!-- ... more faction files ... -->
<script type="text/javascript" src="./js/chooser.js"></script>
```

Order within the faction block does not matter — all faction files call `registerFaction` which just populates `ArmyforgeUnitProfiles`, and `chooser.js` reads from it after all scripts have run.

### Step 4: Register the finder in `chooser.js`

Open `war/js/chooser.js` and find the `profileFindersByListId` object (around line 260). Add an entry for every army ID your faction handles:

```js
var profileFindersByListId = {
    // ... existing entries ...
    'MY_faction_NETEA': ArmyforgeUnitProfiles.findMyFactionProfileByName,
    // ...
};
```

The key must match the army ID used in `armyIds` and in the list file at `war/lists/MY_faction_NETEA.json`. The value must match the `findFunctionName` you registered.

### Step 5: Verify locally

```bash
cd war
python3 -m http.server 8000
# Open http://localhost:8000/chooser.html?list=MY_faction_NETEA
```

Click on a formation. The unit profile panel should populate. Open the browser console — a `null` return from the finder, or a "unitProfileLoader: empty response" warning, points to a path or normalizer problem.

---

## Recipe — Update an existing faction's unit stats

### DYNAMIC factions (loader-based): edit source-json only

For the seven factions already migrated to the loader, the JS file is pure config — it does not hardcode any stats. To change a unit's speed, armour, weapons, or abilities, edit the corresponding source-json file and reload the page. No JS change needed.

**Migrated factions** (read `war/source-json/*.json` at runtime):

| Namespace | Source-json file | Finder function |
|---|---|---|
| `deathGuard` | `death-guard.json` | `findDeathGuardProfileByName` |
| `exploratorFleet` | `explorator-fleet.json` | `findExploratorFleetProfileByName` |
| `hedonicCrusade` | `hedonic-crusade.json` | `findHedonicCrusadeProfileByName` |
| `smCodexAstartes` | `space-marine-codex-astartes.json` | `findSmCodexAstartesProfileByName` |
| `thousandSons` | `thousand-sons.json` | `findThousandSonsProfileByName` |
| `traitorTitanLegions` | `traitor-titan-legions.json` | `findTraitorTitanLegionsProfileByName` |
| `vraksianTraitors` | `vraksian-traitors.json` | `findVraksianTraitorsProfileByName` |

Example: to update Plague Marines' speed from 15cm to 20cm, edit `war/source-json/death-guard.json`, find the `"name": "Plague Marines"` entry, and change `"speed": "15cm"` to `"speed": "20cm"`. That is the entire change.

### STATIC factions: edit the JS literal

For unmigrated factions the stats live directly in the JS file. Find the profile in `war/js/unitProfiles.<faction>.js` and edit the object literal. You can also migrate the faction to the loader (next recipe) if it already has complete source-json coverage — run `node tools/audit-source-json-completeness.js` first to check for gaps.

---

## Recipe — Migrate a STATIC faction to the loader

`war/js/unitProfiles.smCodexAstartes.js` is the worked example of a completed migration. Read it alongside these steps.

### Step 1: Confirm source-json coverage

```bash
node tools/audit-source-json-completeness.js
```

Find your faction in the output. The report shows how many profiles are in the JS literal but absent from source-json ("gaps"). Migrating before filling gaps means the runtime version will silently be missing units. Fill the gaps first (transcribe the missing profiles into `war/source-json/<faction>.json`), then migrate.

### Step 2: Read the existing JS file

Identify three things:

1. **The normalizer function** — there will be a `function(displayName)` that lowercases and strips noise. Copy it; you will attach it to `ArmyforgeUnitProfiles` under a new name.

2. **The `nameToKey` table** — a JS object mapping display strings to snake_case keys like `{ "Tactical Marines": "tactical_marines", ... }`. These keys are the property names of the `profiles` object literal.

3. **Additional-profiles helpers** (optional) — some factions have `<faction>AdditionalProfilesForFormation(formation)` functions. Keep these; they are formation-specific logic not handled by the loader.

### Step 3: Translate `nameToKey` to `aliases` shape

The loader's `aliases` maps display strings to **canonical profile names** — the `name` field as it appears in source-json — **not** to snake_case keys. The loader derives the key internally.

Old STATIC shape:
```js
// nameToKey in the STATIC file
nameToKey: {
    "Tactical": "tactical_marines",
    "Tactical Marines": "tactical_marines"
}
```

New `aliases` shape for `registerFaction`:
```js
aliases: {
    "Tactical":        "Tactical Marines",   // value = profile name in source-json
    "Tactical Marines": "Tactical Marines"
}
```

The profile name `"Tactical Marines"` is passed through the normalizer and then has whitespace replaced with `_` to produce the key `tactical_marines`. The source-json profile must have `"name": "Tactical Marines"` exactly.

### Step 4: Rewrite the JS file

Replace the entire `profiles` object literal and `nameToKey` table with a `registerFaction` call. Use the template from "Add a new faction" above. The normalizer body comes from the existing file; just attach it to `ArmyforgeUnitProfiles` before the `registerFaction` call.

Keep any `<faction>AdditionalProfilesForFormation` and `<faction>FormationHasUpgrade` helper functions below the `registerFaction` call — they are separate from the loader and unaffected by migration.

Before:
```js
ArmyforgeUnitProfiles.myFaction = {
    armyIds: ['MY_faction_NETEA'],
    profiles: {
        my_trooper: { name: "My Trooper", type: "INF", ... },
        // ... 80 more entries ...
    },
    nameToKey: {
        "My Trooper": "my_trooper",
        "My Troopers": "my_trooper",
        // ...
    }
};

ArmyforgeUnitProfiles.findMyFactionProfileByName = function(displayName, listId) {
    // ... boilerplate lookup logic ...
};
```

After:
```js
ArmyforgeUnitProfiles.normalizeMyFactionName = ArmyforgeUnitProfiles.normalizeMyFactionName || function(displayName) {
	// ... normalizer body from original file ...
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'myFaction',
	findFunctionName: 'findMyFactionProfileByName',
	armyIds: ['MY_faction_NETEA'],
	sourceJsonPaths: ['./source-json/my-faction.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeMyFactionName,
	aliases: {
		'My Troopers': 'My Trooper',
		'My Trooper':  'My Trooper'
		// ...
	}
});
```

### Step 5: Browser-verify

Load `http://localhost:8000/chooser.html?list=MY_faction_NETEA` and click through several formations. Check the browser console for loader warnings. If a unit shows blank stats, the profile name in `aliases` does not match the `name` in source-json (case-sensitive), or the normalizer strips something it should not.

---

## Conventions

- **ASCII quotes only.** Single (`'`) and double (`"`) quotes — never smart/curly quotes (`'` `'` `"` `"`). Smart quotes in JS files cause syntax errors. The CI faction-syntax job (`node --check`) catches this on every PR.
- **Tab indentation in JS files.** Match the existing files — tabs, not spaces.
- **2-space indentation in JSON files.** Source-json and list files use 2-space indent.
- **No `Co-Authored-By: Claude ...` trailers** in commit messages. This project does not use AI co-author trailers.
- **Run tests before pushing.** `node --test tools/test/loader.test.js` must pass (19/19 tests) for any change touching the loader or faction files.

---

## Testing

### Unit tests

```bash
node --test tools/test/loader.test.js
```

Covers `cloneProfile`, `deriveKey`, `registerAlias`, `buildFinder`, and `registerFaction` (19 tests). These run under Node 18+ with no install step.

### Syntax check (all faction files)

```bash
for f in war/js/unitProfiles.*.js; do node --check "$f" && echo "OK: $f"; done
```

Catches smart-quote regressions and other syntax errors before they reach the browser.

### Source-json completeness audit

```bash
node tools/audit-source-json-completeness.js
```

Reports profiles present in JS literals but absent from source-json ("gaps"). Run this before migrating a STATIC faction, and after adding profiles to a source-json file, to confirm zero gaps.

### Faction inventory

```bash
node tools/inventory-factions.js
```

Classifies every `unitProfiles.*.js` file as MIGRATED (uses loader) / DYNAMIC (defines own finder without loader) / STATIC-OK (has source-json) / STATIC-NO-SOURCE (no source-json). Useful for tracking migration progress.

### Local server

```bash
cd war
python3 -m http.server 8000
# http://localhost:8000/chooser.html?list=SM_codex_NETEA   (Space Marines, DYNAMIC)
# http://localhost:8000/chooser.html?list=CHAOS_dg_NETEA   (Death Guard, DYNAMIC)
# http://localhost:8000/chooser.html?list=EL_bieltan_NETEA  (Eldar, STATIC)
```

No build step. No `npm install`. Node 18+ is the only requirement.

---

## Reference: data layer

- **Source-json shape:** `schemas/source-json.schema.json` (JSON Schema draft-07). Add `"$schema": "../../schemas/source-json.schema.json"` to get editor autocomplete.
- **List shape:** `schemas/list.schema.json`. Authoritative for formations, costs, upgrades.
- **TS types:** `schemas/types.ts` (generated; run `node tools/generate-types.js` to regenerate).
- **Data model decisions:** `docs/design/data-model.md` — explains the hybrid raw-text/structured-sibling encoding, the stable-ID plan, the source-json vs lists file split, and the JSON Schema approach.

The key rule from Decision C: `source-json/<faction>.json`'s `formations[]` array is **informational only** (scraped from rulebook prose). All authoritative formation config — costs, upgrades, point values — lives in `war/lists/<faction>_<ruleset>.json`. Tools and the new backend MUST read from lists, not from source-json formations.

---

## Internal architecture (for the curious)

`registerFaction` runs synchronously at page-load time, before `chooser.js` executes. It fires one synchronous `Ajax.Request` (Prototype.js) per path in `sourceJsonPaths`. Synchronous XHR is deprecated in modern browsers for user-initiated fetches, but it is still permitted for script-initiated requests at load time. This keeps the faction files simple: they register once, and every subsequent call to the finder is a pure in-memory lookup with no async plumbing.

Profile objects are deep-cloned on ingestion via `cloneProfile` — a shallow struct copy plus `Array#slice` on `weapons` and `notes`. This means the caller can mutate a returned profile (e.g. to append a formation upgrade's stats) without corrupting the cached copy. The `abilities_or_notes` field name (used in older source-json files) is normalised to `abilities` during cloning. Aliases are resolved lazily at lookup time: `buildFinder` returns a closure that normalises the query string, checks `nameToKey`, and falls back to the whitespace-stripped variant. The finder returns `null` — not `undefined` — on miss, which is what `chooser.js` tests for.
