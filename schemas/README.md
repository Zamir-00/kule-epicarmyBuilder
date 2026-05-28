# JSON Schemas

This directory contains JSON Schema (draft-07) definitions for the two main data
file formats in this project, plus auto-generated TypeScript types.

## Files

| File | Covers |
|---|---|
| `source-json.schema.json` | `war/source-json/*.json` — extracted army data |
| `list.schema.json` | `war/lists/*.json` — army list builder files |
| `types.ts` | TypeScript interfaces auto-generated from the schemas |

## Editor integration via `$schema`

Add a `"$schema"` key at the top of any data file to get live validation and
autocomplete in editors such as VS Code:

```json
{
  "$schema": "../../schemas/source-json.schema.json",
  "metadata": { ... }
}
```

The relative path above works for files in `war/source-json/`.  For
`war/lists/` files use the same relative path:

```json
{
  "$schema": "../../schemas/list.schema.json",
  "id": "...",
  ...
}
```

Three representative files already carry `$schema` references:

- `war/source-json/death-guard.json`
- `war/source-json/space-marine-codex-astartes.json`
- `war/lists/CHAOS_dg_NETEA.json`

## Regenerating TypeScript types

```
node tools/generate-types.js
```

The script uses `json-schema-to-typescript@15` (fetched via npx on first run)
and writes `schemas/types.ts`.  The generated file is committed and tracked in
git so contributors do not need to regenerate it unless the schemas change.

## Design philosophy: loose now, tightened later

The schemas are intentionally permissive in Phase 1 (story S1.10).  The goal
is to catch regressions — if a commit accidentally deletes a field or changes a
type, validation will fail — not to enforce the final ideal shape today.

**Known relaxations:**

- `profiles[].name` is the only required field; `id`, `armour_save` etc. are
  optional (will become required after **S1.11** adds stable IDs).
- Provenance fields (`source_section`, `parse_confidence`, `parse_warnings`,
  `ambiguity_reasons`, `is_reference_or_ambiguous`) are accepted but optional;
  they will be dropped by the normaliser in **S1.12**.
- `metadata.source_url` allows `null` (19 files currently have `null`).
- `army_notes` items may be plain strings or `{name, text}` objects.
- `pts` values in list files are unconstrained (`{}`) because they appear as
  integers, floats (e.g. `112.5`), and even arrays (e.g. `[50, 25]`).

Future stories that will tighten the schema:

- **S1.11** — add `id` field to all profiles; schema can then require `id`.
- **S1.12** — normalise stat fields (`armour_save`, `cc_target`, etc.); schema
  can then require these structured siblings.

## CI validation

The schema-validation CI job (`.github/workflows/ci.yml`) runs on every push
and pull request.  It validates:

- All `war/source-json/*.json` files against `source-json.schema.json`
- All `war/lists/*.json` files against `list.schema.json`

Two list files (`EL_mymeara_NETEA.json`, `TEMPLATE.json`) contain invalid JSON
and will produce a parse error in the ajv-cli output; this is known and will be
fixed separately.
