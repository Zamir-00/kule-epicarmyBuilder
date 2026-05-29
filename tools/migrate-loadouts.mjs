#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LISTS_DIR = path.join(REPO_ROOT, 'war', 'lists');

/**
 * Pure transform: given a parsed list JSON, return a new JSON with loadout_slots added
 * for high-confidence upgradeConstraints rows where min/max != 1, plus a report.
 *
 * Does NOT remove the original upgradeConstraints rows (legacy chooser-html keeps reading them).
 * Idempotent: re-running on output is a no-op.
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
    // Skip: migrate-swaps handles min=max=1
    if (c.min === 1 && c.max === 1) continue;
    // Skip: malformed
    if (!Array.isArray(c.from) || c.from.length < 1) continue;
    if (!Array.isArray(c.appliesTo) || c.appliesTo.length === 0) continue;

    // Resolve from-upgrades; all must exist
    const fromUpgrades = c.from.map((id) => upgradesById.get(id));
    if (fromUpgrades.some((u) => !u)) {
      report.push({ tier: 'medium', reason: 'from references unknown upgrade', constraint: c });
      continue;
    }

    // Determine default per pattern:
    //   - min=max=N, min=N+open, range A..B: cheapest variant (first listed breaks ties)
    //   - min=undef/max-only: no default
    const minSet = typeof c.min === 'number' && c.min >= 1;
    const needDefault = minSet; // any pattern where min >= 1
    let defaultUpgradeId = null;
    if (needDefault) {
      let cheapestPts = Infinity;
      for (const id of c.from) {
        const u = upgradesById.get(id);
        const pts = u?.cost_pts ?? u?.pts ?? 0;
        if (pts < cheapestPts) {
          cheapestPts = pts;
          defaultUpgradeId = id;
        }
      }
      // Tiebreaker: lowest pts ties → first in c.from. The loop above already picks the
      // FIRST occurrence of the cheapest value (because `<` not `<=`), so first-in-from wins.
    }

    // Pre-compute candidate slot string_id (deduped per-formation below)
    const variantStringIds = c.from.map((id) => upgradesById.get(id)?.string_id ?? String(id));
    const candidateSlotStringId = `loadout_${variantStringIds.join('_or_')}`.slice(0, 80);

    const appliedFormations = [];
    const skippedFormations = [];
    for (const formationId of c.appliesTo) {
      const f = formationsByIdMap.get(formationId);
      if (!f) {
        report.push({ tier: 'medium', reason: `appliesTo formation ${formationId} not found`, constraint: c });
        continue;
      }
      const formationUpgradeIds = new Set(f.upgrades ?? []);
      const overlap = c.from.filter((id) => formationUpgradeIds.has(id));
      if (overlap.length > 0) {
        report.push({
          tier: 'medium',
          reason: `variant(s) ${overlap.join(',')} also in formation ${formationId} upgrades[]`,
          constraint: c,
        });
        continue;
      }
      // Cross-system check: variants in any sibling swap_slot.variants[]
      const swapSlotUpgradeIds = new Set();
      for (const ss of f.swap_slots ?? []) {
        for (const v of ss.variants ?? []) swapSlotUpgradeIds.add(v.upgrade_id);
      }
      const swapOverlap = c.from.filter((id) => swapSlotUpgradeIds.has(id));
      if (swapOverlap.length > 0) {
        report.push({
          tier: 'medium',
          reason: `variant(s) ${swapOverlap.join(',')} also in swap_slot on formation ${formationId} (cross-system)`,
          constraint: c,
        });
        continue;
      }
      // Idempotency: a loadout_slot already covers this exact from-set with matching min/max
      const existingSlot = (f.loadout_slots ?? []).find((s) =>
        Array.isArray(s.variants) &&
        s.variants.length === c.from.length &&
        c.from.every((id) => s.variants.some((v) => v.upgrade_id === id)) &&
        s.min === c.min &&
        s.max === c.max
      );
      if (existingSlot) {
        skippedFormations.push(formationId);
        continue;
      }

      // Apply: add loadout_slot to this formation.
      f.loadout_slots = f.loadout_slots ?? [];
      let slotStringId = candidateSlotStringId;
      // Dedupe against existing loadout_slots AND swap_slots on the formation
      const existingStringIds = new Set([
        ...(f.loadout_slots.map((s) => s.string_id) || []),
        ...(f.swap_slots?.map((s) => s.string_id) || []),
      ]);
      if (existingStringIds.has(slotStringId)) {
        let n = 2;
        while (existingStringIds.has(`${slotStringId}_${n}`)) n++;
        slotStringId = `${slotStringId}_${n}`;
      }
      const variants = c.from.map((id) => ({
        upgrade_id: id,
        ...(id === defaultUpgradeId ? { is_default: true } : {}),
      }));
      // Build slot object with key order: string_id, label, min?, max?, variants
      const orderedSlot = {
        string_id: slotStringId,
        label: 'Choice',
        ...(typeof c.min === 'number' && c.min > 0 ? { min: c.min } : {}),
        ...(typeof c.max === 'number' ? { max: c.max } : {}),
        variants,
      };
      f.loadout_slots.push(orderedSlot);
      appliedFormations.push(formationId);
    }

    if (appliedFormations.length > 0) {
      report.push({
        tier: 'high',
        formationIds: appliedFormations,
        fromUpgradeIds: [...c.from],
        defaultUpgradeId,
        ...(skippedFormations.length > 0 ? { alreadyMigratedFormations: skippedFormations } : {}),
      });
    }
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
      continue;
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
