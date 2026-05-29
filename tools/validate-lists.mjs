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
