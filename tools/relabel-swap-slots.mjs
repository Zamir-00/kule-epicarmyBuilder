#!/usr/bin/env node
// One-off heuristic relabeler. Reads war/lists/*.json, finds swap_slots
// with `label: "Choice"`, and applies pattern-based labels when the
// variant names match a known category. Leaves "Choice" in place when
// no pattern matches.
//
// Run: node tools/relabel-swap-slots.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LISTS_DIR = path.join(REPO_ROOT, 'war', 'lists');
const APPLY = process.argv.includes('--apply');

function deriveLabel(variantNames) {
  const lower = variantNames.join(' || ').toLowerCase();
  const isAll = (re) => variantNames.every((n) => re.test(n));

  // Mark of Chaos — variants are deity names
  if (variantNames.length >= 4 && /khorne/.test(lower) && /nurgle/.test(lower) && /slaanesh/.test(lower) && /tzeentch/.test(lower)) {
    return 'Mark of Chaos';
  }

  // Custodes detachment unit types
  if (isAll(/custodes/i)) {
    return 'Custodes type';
  }

  // Titan paired weapons (carapace)
  if (variantNames.length >= 3 && isAll(/^\s*paired\s+/i)) {
    return 'Carapace weapons';
  }

  // All weapons (cannons, lasers, missiles, blasters)
  if (variantNames.length >= 3 && isAll(/cannon|destructor|destructur|missile|blaster|blastgun|gun\b|laser/i)) {
    return 'Weapon';
  }

  // Titan/Knight configurations
  if (isAll(/configuration/i)) {
    return 'Configuration';
  }

  // Imperator/Warmonger style upgrades for Titans
  if (variantNames.length === 2 && /imperator/i.test(lower) && /warmonger/i.test(lower)) {
    return 'Configuration';
  }

  // No match — keep "Choice"
  return null;
}

const summary = { totalChoice: 0, relabeled: 0, byLabel: {} };

for (const fname of (await fs.readdir(LISTS_DIR)).sort()) {
  if (!fname.endsWith('.json')) continue;
  const filePath = path.join(LISTS_DIR, fname);
  let json;
  try {
    json = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    continue;
  }

  const upgradeNamesById = new Map();
  for (const u of json.upgrades ?? []) {
    if (u.id !== undefined) upgradeNamesById.set(u.id, u.name ?? '');
  }

  let changed = false;
  for (const section of json.sections ?? []) {
    for (const formation of section.formations ?? []) {
      for (const slot of formation.swap_slots ?? []) {
        if (slot.label !== 'Choice') continue;
        summary.totalChoice++;
        const variantNames = (slot.variants ?? [])
          .map((v) => upgradeNamesById.get(v.upgrade_id))
          .filter((n) => typeof n === 'string' && n.length > 0);
        const newLabel = deriveLabel(variantNames);
        if (newLabel) {
          slot.label = newLabel;
          summary.relabeled++;
          summary.byLabel[newLabel] = (summary.byLabel[newLabel] ?? 0) + 1;
          changed = true;
          console.log(`${fname}\t${formation.name}\t${slot.string_id.slice(0, 50)}...\t-> ${newLabel}`);
        }
      }
    }
  }

  if (changed && APPLY) {
    await fs.writeFile(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  }
}

console.log('\nSummary:');
console.log(`  Choice-labeled slots scanned: ${summary.totalChoice}`);
console.log(`  Relabeled:                    ${summary.relabeled}`);
for (const [label, n] of Object.entries(summary.byLabel)) {
  console.log(`    ${label}: ${n}`);
}
console.log(`  Mode: ${APPLY ? 'apply (files written)' : 'dry-run'}`);
