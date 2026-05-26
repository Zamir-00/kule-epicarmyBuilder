# Source-JSON → Unit-Profiles Generator

**Status:** Design — pending implementation
**Date:** 2026-05-26
**Owner:** mirza.sahinkaya@efsora.com

## Background

The repo carries three parallel data layers for army-list content:

1. `war/source-json/*.json` — scraped from `tp.net-armageddon.org/army-lists/...`. Authoritative source. 56 files.
2. `war/js/unitProfiles.*.js` — UI unit-card statlines plus a `nameToKey` synonym table and a `find<Faction>ProfileByName` lookup function. Loaded by `war/js/chooser.js` and indexed via the `profileFindersByListId` switch at `chooser.js:260-315`. 50 files.
3. `war/lists/*.json` — the actual army-builder data (formations, point costs, upgrades). References units by free-text names which the JS layer resolves via `nameToKey`. 157 files.

Layer 2 was hand-translated from layer 1. Drift is inevitable — that is exactly why `war/source-json/*.audit.md` files exist (e.g. `death-guard.audit.md` enumerates compressed table rows, parse warnings, and formation-to-profile name mismatches).

The user's stated goal: stop hand-translating, eliminate the drift class. UI behavior, list-builder behavior, and on-disk structure of layers 1 and 3 are unchanged. This spec is narrowly about producing layer 2 from layer 1 + a sidecar that captures the human-curated bits.

## Goals

- Generate `war/js/unitProfiles.<faction>.js` deterministically from `war/source-json/<faction>.json` + a sidecar `war/source-json/<faction>.synonyms.json`.
- Preserve current UI behavior: same profile keys, same `armyIds`, same `find<Faction>ProfileByName` function name, same `nameToKey` resolution, same per-faction `normalize<Faction>ListName` regex behavior.
- One-time migration: mine the 50 existing JS files into sidecars so future drift only happens in source-json or sidecars, never both.
- Pilot on two factions, verify in browser, then regenerate the remaining 48 in one commit.

## Non-goals

- No changes to `chooser.js`, `ArmyList.js`, `Force.js`, or any `war/lists/*.json` file.
- No new build pipeline, no `package.json`, no test framework adoption — the generator is a standalone Node script run manually (and optionally from a pre-commit hook).
- No byte-for-byte equivalence with today's hand-written JS. Goal is *semantically equivalent* output. `nameToKey` ordering will differ (the generator emits alphabetical, today's is semi-arbitrary).
- The 6 source-json factions that lack a JS counterpart are not addressed by this spec. The generator can produce them later, but wiring into `chooser.js:260-315` is a separate task.
- No migration of `lists/*.json` to profile keys. That is the higher-leverage but out-of-scope option B from the earlier audit.

## Architecture

### Repository layout (post-implementation)

```
kule-epicarmyBuilder/
├── tools/                                  ← new directory
│   ├── gen-unit-profiles.js                ← the generator
│   ├── extract-synonyms.js                 ← one-time mining script
│   ├── faction-config.js                   ← registry of factions
│   ├── lib/
│   │   ├── transform.js                    ← pure source-json → profile-object transform
│   │   └── emit.js                         ← profile-object → JS source string (template)
│   └── README.md                           ← how to run + when
├── war/
│   ├── source-json/
│   │   ├── death-guard.json                ← already exists, canonical, untouched
│   │   ├── death-guard.synonyms.json       ← NEW sidecar, hand-maintained going forward
│   │   ├── death-guard.audit.md            ← already exists, untouched
│   │   └── …
│   └── js/
│       └── unitProfiles.deathGuard.js      ← REGENERATED, header marks it generated
```

`tools/` lives at repo root because it is build-time tooling, not deployed content (`war/` is the deployable webroot). Sidecars live next to their source-json siblings because they pair 1:1.

### Faction registry

`tools/faction-config.js` is the single source of truth for which factions exist and how they map between source-json filenames and JS output filenames:

```js
module.exports = [
  {
    slug: 'death-guard',
    sourceJson: 'death-guard.json',
    jsOut: 'unitProfiles.deathGuard.js',
    generated: true   // opt-in flag; see Rollout
  },
  {
    slug: 'space-marine-codex-astartes',
    sourceJson: 'space-marine-codex-astartes.json',
    jsOut: 'unitProfiles.smCodexAstartes.js',
    generated: true
  },
  // ... 48 more, all with generated: false during the pilot phase
];
```

The `slug` matches the source-json filename root. The `jsOut` filename's namespace (e.g. `smCodexAstartes`, `deathGuard`, `igSteelLegion`) varies unpredictably and is preserved verbatim from the existing JS files.

The `generated: true` opt-in flag exists so `--check` mode can run during the pilot without flagging the 48 still-hand-written files as out-of-date. The flag flips to `true` for a faction in the same commit that regenerates its JS file.

### Sidecar shape

`war/source-json/<slug>.synonyms.json` carries everything the generator needs that is *not* in source-json:

```json
{
  "armyIds": ["CHAOS_dg_NETEA"],
  "namespace": "deathGuard",
  "findFunctionName": "findDeathGuardProfileByName",
  "normalizerName": "normalizeDeathGuardListName",
  "normalizerBody": "function(displayName) { ... full function source ... }",
  "nameToKey": {
    "plague marines": "plague_marines",
    "plague marine retinue": "plague_marines"
  },
  "keyOverrides": {
    "Razorback (Twin Heavy Bolter)": "razorback_hb"
  },
  "includeReferenceProfiles": ["spacecraft", "ambush", "planetfall"]
}
```

Fields:

- `armyIds` — values used by `chooser.js` to match a list to its profile finder.
- `namespace` — the `ArmyforgeUnitProfiles.<namespace>` key. Doesn't appear in source-json.
- `findFunctionName` — must match `chooser.js:260-315` references exactly; the generator emits a function with this exact name.
- `normalizerName` — name of the per-faction list-name normalizer.
- `normalizerBody` — full source text of the normalizer function, captured verbatim by the extractor. Each faction's normalizer has subtle regex quirks (e.g. `smCodexAstartes` strips chapter names like `salamander`, `white scar`); reconstructing this from declarative rules would be more brittle than carrying the source as a string.
- `nameToKey` — synonym map. Lowercase keys → snake_case profile keys.
- `keyOverrides` (optional) — display-name → key, for cases where the slug-derived key doesn't match today's key (e.g. `Razorback (Twin Heavy Bolter)` → `razorback_hb`, not `razorback_twin_heavy_bolter`).
- `includeReferenceProfiles` (optional) — profile keys to include even though their source-json entry is flagged `is_reference_or_ambiguous: true`. Preserves curated "reference card" entries like `spacecraft`, `ambush`, `planetfall`.

## Transform rules

Pure function `(sourceJsonProfile, sidecar) → jsProfileObject`. Six rules:

**R1. Field rename.** `abilities_or_notes` (source-json) → `abilities` (JS).

**R2. Drop provenance fields.** Strip from each profile: `source_section`, `parse_confidence`, `parse_warnings`, `ambiguity_reasons`, `is_reference_or_ambiguous`. UI does not consume them.

**R3. Range normalization.** Strip leading/trailing parens on weapon range strings. `"(base contact)"` → `"base contact"`. Confirmed against `source-json/death-guard.json` vs `js/unitProfiles.deathGuard.js`. No other range edits.

**R4. Key derivation.** Profile key = `name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')`. So `"Lord of Contagion"` → `"lord_of_contagion"`. If `sidecar.keyOverrides[name]` exists, use that instead.

**R5. Reference-profile filter.** Skip source-json profiles flagged `"is_reference_or_ambiguous": true` UNLESS the profile key appears in `sidecar.includeReferenceProfiles`.

**R6. Key collision handling.** If two source-json profiles slug to the same key after R4, the generator errors and exits, printing both source rows and suggesting a `keyOverrides` entry. Silent overwrites are how data gets lost.

**Output formatting.** One profile per line (matching today's style at `js/unitProfiles.smCodexAstartes.js:15`). Strings JSON-stringified so apostrophes in critical-hit text escape correctly. Profiles emitted in source-json `profiles[]` array order (mirrors rulebook order, minimizes diffs against existing files). `nameToKey` emitted alphabetically by key for stable diffs.

The transform does not:
- Add new synonyms. Synonyms only come from the sidecar.
- Edit source-json. Read-only.
- Generate `normalize<Faction>ListName` from scratch. The body is inlined from `sidecar.normalizerBody`.

## Generator behavior

### Invocation

```
node tools/gen-unit-profiles.js                       # all factions where generated: true
node tools/gen-unit-profiles.js death-guard           # one faction
node tools/gen-unit-profiles.js death-guard --check   # exit 1 if output differs from on-disk
node tools/gen-unit-profiles.js --check               # CI-friendly: all generated factions, no writes
```

No watch mode, no parallelism. 50 files, milliseconds.

### Per-faction pipeline

1. Read `war/source-json/<sourceJson>`. Error if missing.
2. Read `war/source-json/<slug>.synonyms.json`. Error if missing — point user at `extract-synonyms.js`.
3. Validate sidecar: required fields present (`armyIds`, `namespace`, `findFunctionName`, `normalizerName`, `normalizerBody`, `nameToKey`).
4. Run transform (R1–R6) over `sourceJson.profiles[]`. Collect errors. Bail on first error per faction with a clear message; never half-write.
5. Cross-check: every value in `sidecar.nameToKey` must resolve to a profile key that exists after step 4. Otherwise error.
6. Render the JS file via `emit.js`.
7. If `--check`: read current `<jsOut>`, string-compare, exit 1 with diff on mismatch. Otherwise write atomically (tmp + rename).

### Emit template (sketch)

```js
// DO NOT EDIT — generated by tools/gen-unit-profiles.js from source-json/<sourceJson>
// Hand-curated bits live in source-json/<slug>.synonyms.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.<namespace> = {
    armyIds: <armyIds>,
    profiles: {
        <profileLines>
    },
    nameToKey: {
        <nameToKeyLines>
    }
};

ArmyforgeUnitProfiles.<normalizerName> = <normalizerBody>;

ArmyforgeUnitProfiles.<findFunctionName> = function(displayName, listId) {
    if (!displayName) return null;
    if (listId && !ArmyforgeUnitProfiles.<namespace>.armyIds.member(listId)) return null;
    var normalized = ArmyforgeUnitProfiles.<normalizerName>(displayName);
    var key = ArmyforgeUnitProfiles.<namespace>.nameToKey[normalized];
    if (!key) return null;
    return ArmyforgeUnitProfiles.<namespace>.profiles[key] || null;
};
```

The finder function body is identical across all 50 existing files (compare `unitProfiles.smCodexAstartes.js:140-153`); the template parameterizes only `namespace`, `normalizerName`, and `findFunctionName`. `<normalizerBody>` is dropped in as raw source string from the sidecar.

### Determinism

Same input → byte-identical output. No timestamps, no environment variables, no randomness. This is what makes `--check` viable as a correctness gate.

### Failure modes

| Condition | Behavior | Message includes |
|---|---|---|
| Missing source-json | exit 1 | expected path |
| Missing sidecar | exit 1 | "run extract-synonyms.js first" |
| Sidecar missing required field | exit 1 | which field |
| Key collision (R6) | exit 1 | both colliding profile names + suggested `keyOverrides` entry |
| Broken synonym (points at non-existent key) | exit 1 | synonym key + nearest existing keys |
| `--check` mismatch | exit 1 | first ~20 lines of diff |
| Success | exit 0 | one line per faction: `wrote <jsOut> (N profiles)` |

## Extractor (one-time)

`tools/extract-synonyms.js` runs once per faction. Reads `war/js/unitProfiles.<faction>.js`, writes `war/source-json/<slug>.synonyms.json`. After all 50 sidecars exist, the extractor stays in the repo for reproducibility but is not part of the steady-state workflow.

### Invocation

```
node tools/extract-synonyms.js death-guard               # one faction
node tools/extract-synonyms.js death-guard codex         # multiple by slug
node tools/extract-synonyms.js --all                     # every row in faction-config.js
```

The extractor reads `tools/faction-config.js` to learn which factions exist and where their JS files live.

### Parser

Use `acorn` (zero-dep, vendored or `npx`-invoked). Existing JS is valid ES5. AST parsing beats regex because `nameToKey` keys can contain commas inside string values.

### Extraction targets

For each JS file:

1. `armyIds` — from the `armyIds:[...]` array on the object literal.
2. `namespace` — from `ArmyforgeUnitProfiles.<namespace> = {...}`.
3. `findFunctionName` — from `ArmyforgeUnitProfiles.findXProfileByName = function(...)`.
4. `normalizerName` — same idea (`normalizeXListName`).
5. `normalizerBody` — full function source as a string.
6. `nameToKey` — the synonym map.
7. `keyOverrides` — derived. For each profile, if `slug(profile.name) !== existingKey`, add `{[profile.name]: existingKey}`.
8. `includeReferenceProfiles` — derived. Profile keys present in the JS that source-json flags `is_reference_or_ambiguous: true`. Computed by joining JS keys against source-json on slugified name.

### What it does not extract

Profile statlines (weapons, abilities, armour). Those come from source-json. If the JS has a statline that source-json doesn't, the extractor logs a warning. This is the one place migration can lose data, and the warning makes it loud.

### Diagnostics produced per faction

- **UNRESOLVED warning** — profile in JS but not in source-json. Requires human resolution before regen (edit source-json or accept loss).
- **NOT-YET-IN-UI info** — non-reference profile in source-json but not in JS. Candidate for future UI work; informational, no action needed.
- **BROKEN-SYNONYM error** — `nameToKey` value pointing at a key absent from both JS and post-transform source-json. Sidecar-level decision required.

Sidecars are pretty-printed JSON, alphabetical where order is irrelevant. They get hand-edited going forward, so legibility matters.

## Rollout

Six commits, each independently revertable.

**Step 1 — Land tooling, generate nothing.**
Add `tools/{gen-unit-profiles.js, extract-synonyms.js, faction-config.js, lib/, README.md}`. `faction-config.js` ships with all 50+ rows but only the two pilot factions carry `generated: true`. Smoke test: `node tools/gen-unit-profiles.js --check` exits 0 (because no faction yet has its `jsOut` regenerated, and `--check` only inspects `generated: true` rows). No changes to `war/`.

**Step 2 — Extract pilot sidecars.**
`node tools/extract-synonyms.js death-guard space-marine-codex-astartes`. Produces two sidecars + a diagnostic report. Resolve UNRESOLVED warnings and BROKEN-SYNONYM errors before committing. Commit the sidecars.

**Step 3 — Regenerate the two pilot JS files.**
`node tools/gen-unit-profiles.js death-guard space-marine-codex-astartes`. Eyeball the diff: identical profile data (modulo R1–R3 rules), `nameToKey` reordered alphabetically, generated header banner added. Open `war/indexNETEA.html` in a browser. For `CHAOS_dg_NETEA` and `SM_codex_NETEA`, load a list and confirm unit cards render with correct statlines for a handful of formations including upgrades. This is the validation gate — no claiming success without it. Flip `generated: true` for both factions in the same commit.

**Step 4 — Extract remaining 48 sidecars.**
`node tools/extract-synonyms.js --all` (excluding pilots). Bulk-review diagnostics; cluster warnings (factions with no `normalize<X>ListName`, factions with broken synonyms, etc.) and resolve. Commit the 48 sidecars.

**Step 5 — Regenerate remaining 48 JS files.**
`node tools/gen-unit-profiles.js`. Review the bulk diff. Expect only header banners + alphabetical `nameToKey` for most files; flag anything else. Spot-check 4–5 factions in the browser across different rulesets. Flip `generated: true` for all 48 in the same commit.

**Step 6 — Lock it down.**
Document in `tools/README.md` that source-json edits require running `node tools/gen-unit-profiles.js` before commit. Provide an opt-in `.git/hooks/pre-commit` script that runs `--check`. The hook is not tracked by git; document the install command. CI workflow is optional and punted unless explicitly requested.

### Rollback strategy

Each step is a single commit and revertable in isolation. Step 3 failure → revert the regenerated JS, fix the transform or sidecar, retry. Step 5 failure on a specific faction → revert just that file, mark `generated: false`, ship the rest, deal with the outlier as a follow-up. The pilot exists precisely to surface transform bugs before they hit 48 files at once.

### Estimated effort

- Step 1: 3–4 hours (script + lib + asserts).
- Step 2: 1 hour.
- Step 3: 1–2 hours (most of it is browser verification).
- Steps 4–5: 2–4 hours, dominated by sidecar hand-editing for factions whose JS isn't uniform.
- Step 6: 30 minutes.

Roughly one focused day if the 50 existing JS files are as structurally uniform as the `smCodexAstartes` sample suggested; longer if Step 4 surfaces lots of irregularities.

## Open issues

- **Faction JS files that don't match the canonical shape.** If any of the 50 existing files lacks a `normalize<X>ListName` function, uses a different finder signature, or has multiple namespaces in one file, the extractor must fail loud and the operator decides between special-casing or normalizing the source JS. Known after running step 4.
- **Pre-commit hook delivery.** Tracked git hooks require either Husky-style tooling or a `core.hooksPath` config. To avoid adding a dependency, the design opts for `.git/hooks/pre-commit` with documented manual install. If the user later wants this enforced, revisit.
- **`acorn` delivery.** Either vendor it (small, ~150KB), require `npx acorn`, or write the extractor against a regex-and-state-machine approach. Recommendation: vendor, because the alternative is brittle.
