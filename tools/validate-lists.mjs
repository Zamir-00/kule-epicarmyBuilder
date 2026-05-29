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
