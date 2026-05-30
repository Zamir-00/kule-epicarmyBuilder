#!/usr/bin/env node
// One-off heuristic relabeler. Reads war/lists/*.json, finds loadout_slots
// with `label: "Choice"`, and applies pattern-based labels when the
// variant names match a known category. Leaves "Choice" in place when
// no pattern matches.
//
// Patterns mirror tools/relabel-swap-slots.mjs but with broader weapon
// detection and a few loadout-only patterns (Minorus-style "X with Y"
// loadouts, Squad/Squadron variants, Unit-type detachments).
//
// Run: node tools/relabel-loadout-slots.mjs [--apply]

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

  // "X with Y weapon" loadout pattern — e.g. Minorus with Vulcan Megabolter,
  // Knight Errant with Reaper Chainsword. All variants share a leading head
  // noun + " with " + weapon name.
  if (variantNames.length >= 2 && isAll(/\bwith\b/i)) {
    const head = variantNames[0].split(/\bwith\b/i)[0].trim();
    if (head && variantNames.every((n) => n.toLowerCase().startsWith(head.toLowerCase()))) {
      // Clean up the head noun: strip leading articles (the/a/an) and any trailing
      // punctuation/whitespace that the split may have left behind. E.g. without this,
      // "Oddboy (with Big Shoota" → split → "Oddboy (" → label "Oddboy ( loadout" (ugly).
      const cleanHead = head
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[\s(\[{<,\-–—:]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanHead) return null;
      return `${cleanHead} loadout`;
    }
  }

  // "X Configuration" — Titan/Warmonger style
  if (isAll(/configuration/i)) {
    return 'Configuration';
  }
  if (variantNames.length === 2 && /imperator/i.test(lower) && /warmonger/i.test(lower)) {
    return 'Configuration';
  }

  // All variants are weapons by noun (cannons, lasers, missiles, blasters, etc.)
  // Broader regex than the swap version because loadout variants more often
  // include compound names like "Vulcan Megabolter" or "Quake Cannon".
  if (
    variantNames.length >= 2 &&
    isAll(/cannon|destructor|destructur|missile|blaster|blastgun|\bgun\b|laser|megabolter|megagun|fist|claw|chainsword|melta|plasma|battlecannon|autocannon|stormhammer/i)
  ) {
    return 'Weapons';
  }

  // Squad / Squadron / Detachment variants
  if (variantNames.length >= 2 && isAll(/\bsquad(ron)?\b/i)) {
    return 'Squad';
  }

  // Vehicle "X tank" / "X transport" patterns
  if (variantNames.length >= 2 && isAll(/\btank\b|\btransport\b|\brhino\b|\brazorback\b|\bchimera\b/i)) {
    return 'Transport';
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
      for (const slot of formation.loadout_slots ?? []) {
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
