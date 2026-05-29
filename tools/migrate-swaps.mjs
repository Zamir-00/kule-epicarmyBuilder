#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LISTS_DIR = path.join(REPO_ROOT, 'war', 'lists');

/**
 * Pure transform: given a parsed list JSON, return a new JSON with swap_slots
 * added for high-confidence constraints, plus a report of all classifications.
 * Does NOT remove the original upgradeConstraints rows (legacy chooser-html
 * still reads them). Idempotent: re-running on output is a no-op.
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
    if (c.min !== 1 || c.max !== 1) continue;
    if (!Array.isArray(c.from) || c.from.length < 2) continue;
    if (!Array.isArray(c.appliesTo) || c.appliesTo.length === 0) continue;

    // Resolve from upgrades; all must exist
    const fromUpgrades = c.from.map((id) => upgradesById.get(id));
    if (fromUpgrades.some((u) => !u)) {
      report.push({ tier: 'medium', reason: 'from references unknown upgrade', constraint: c });
      continue;
    }

    // All variants must share the same pts (high confidence) or are all 0
    const ptsSet = new Set(fromUpgrades.map((u) => u.cost_pts ?? u.pts ?? 0));
    if (ptsSet.size > 1) {
      report.push({ tier: 'medium', reason: 'variants have differing pts', constraint: c });
      continue;
    }

    const defaultUpgradeId = c.from[0];

    // Pre-compute candidate slot string_id (will be deduped per-formation below)
    const variantStringIds = c.from.map((id) => upgradesById.get(id)?.string_id ?? String(id));
    const candidateSlotStringId = `swap_${variantStringIds.join('_or_')}`.slice(0, 80);

    // Per-formation: classify and (for high tier) apply
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
      const existingSlot = (f.swap_slots ?? []).find((s) =>
        Array.isArray(s.variants) &&
        s.variants.length === c.from.length &&
        c.from.every((id) => s.variants.some((v) => v.upgrade_id === id))
      );
      if (existingSlot) {
        // Already migrated for THIS formation — skip silently (no report row).
        skippedFormations.push(formationId);
        continue;
      }

      // Apply for this formation. Dedupe slot string_id within the formation in case
      // truncation produced a collision with another already-added slot.
      f.swap_slots = f.swap_slots ?? [];
      let slotStringId = candidateSlotStringId;
      if (f.swap_slots.some((s) => s.string_id === slotStringId)) {
        let n = 2;
        while (f.swap_slots.some((s) => s.string_id === `${slotStringId}_${n}`)) n++;
        slotStringId = `${slotStringId}_${n}`;
      }
      const variants = c.from.map((id) => ({
        upgrade_id: id,
        ...(id === defaultUpgradeId ? { is_default: true } : {}),
      }));
      f.swap_slots.push({
        string_id: slotStringId,
        label: 'Choice',
        variants,
      });
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
      continue; // skip malformed files
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
