'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FIX = path.resolve(__dirname, 'fixtures', 'migrate-loadouts');

async function runTransform(fileName) {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, fileName), 'utf8'));
  return transformList(input);
}

test('high-confidence exactly-N: emits loadout_slot with default cheapest', async () => {
  const { json, report } = await runTransform('high-confidence-exactly-input.json');
  const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-exactly-output.json'), 'utf8'));
  assert.deepStrictEqual(json, expected);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'high');
});

test('high-confidence up-to-N: emits loadout_slot without default', async () => {
  const { json, report } = await runTransform('high-confidence-up-to-input.json');
  const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-up-to-output.json'), 'utf8'));
  assert.deepStrictEqual(json, expected);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'high');
});

test('medium-confidence (variant in formation.upgrades[]): no transform, report row emitted', async () => {
  const { json, report } = await runTransform('medium-overlap-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'medium-overlap-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'medium');
});

test('skip silently: min=max=1 is migrate-swaps territory', async () => {
  const { json, report } = await runTransform('skip-min-max-1-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'skip-min-max-1-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original);
  assert.strictEqual(report.length, 0);
});

test('idempotency: running transform twice yields the same result', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-exactly-input.json'), 'utf8'));
  const first = transformList(input);
  const second = transformList(first.json);
  assert.deepStrictEqual(second.json, first.json);
  assert.strictEqual(second.report.length, 0);
});

test('partial migration: applies to formations missing the slot only', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = {
    id: 'Partial', list_id: 'PARTIAL',
    sections: [{ name: 'CORE', formations: [
      { string_id: 'f1', id: 1, name: 'F1', pts: 100, cost_pts: 100, upgrades: [],
        loadout_slots: [{ string_id: 'loadout_a_or_b', label: 'Choice', min: 2, max: 2,
          variants: [{ upgrade_id: 10, is_default: true }, { upgrade_id: 11 }] }] },
      { string_id: 'f2', id: 2, name: 'F2', pts: 100, cost_pts: 100, upgrades: [] },
    ] }],
    upgrades: [{ id: 10, string_id: 'a', name: 'A', pts: 0 }, { id: 11, string_id: 'b', name: 'B', pts: 0 }],
    upgradeConstraints: [{ min: 2, max: 2, from: [10, 11], appliesTo: [1, 2] }],
  };
  const { json, report } = transformList(input);
  const f1 = json.sections[0].formations[0];
  const f2 = json.sections[0].formations[1];
  assert.strictEqual(f1.loadout_slots.length, 1, 'F1 must not get a duplicate slot');
  assert.ok(Array.isArray(f2.loadout_slots) && f2.loadout_slots.length === 1, 'F2 should have the slot applied');
  const highRows = report.filter((r) => r.tier === 'high');
  assert.strictEqual(highRows.length, 1);
  assert.deepStrictEqual(highRows[0].formationIds, [2]);
});

test('cross-system overlap with swap_slot variant → medium', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = {
    id: 'CrossSystem', list_id: 'CROSSSYS',
    sections: [{ name: 'CORE', formations: [
      { string_id: 'f', id: 1, name: 'F', pts: 100, cost_pts: 100, upgrades: [],
        swap_slots: [{ string_id: 'sw', label: 'Swap',
          variants: [{ upgrade_id: 10, is_default: true }, { upgrade_id: 11 }] }] },
    ] }],
    upgrades: [{ id: 10, string_id: 'a', name: 'A', pts: 0 }, { id: 11, string_id: 'b', name: 'B', pts: 0 }, { id: 12, string_id: 'c', name: 'C', pts: 0 }],
    upgradeConstraints: [{ min: 2, max: 2, from: [10, 12], appliesTo: [1] }],
  };
  const { report } = transformList(input);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'medium');
});

test('truncation collision dedupe: two long constraints get unique string_ids', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  // Construct variant string_ids that force a truncation collision at slice(0, 80).
  // Candidate slot string_id = `loadout_<longA>_or_<longB>` (8 + 50 + 4 + 50+ chars).
  // The first 80 chars are: "loadout_" + 50 a's + "_or_" + 18 b's. Both constraints
  // share that prefix; their differentiating suffix (_alpha vs _beta) starts past
  // position 80, so without dedupe they'd produce identical string_ids.
  const longA = 'a'.repeat(50);
  const longB1 = 'b'.repeat(50) + '_alpha';
  const longB2 = 'b'.repeat(50) + '_beta';
  const input = {
    id: 'Trunc', list_id: 'TRUNC',
    sections: [{ name: 'CORE', formations: [{ string_id: 'f', id: 1, name: 'F', pts: 100, cost_pts: 100, upgrades: [] }] }],
    upgrades: [
      { id: 10, string_id: longA, name: 'A', pts: 0 },
      { id: 11, string_id: longB1, name: 'B1', pts: 0 },
      { id: 12, string_id: longB2, name: 'B2', pts: 0 },
    ],
    upgradeConstraints: [
      { min: 2, max: 2, from: [10, 11], appliesTo: [1] },
      { min: 2, max: 2, from: [10, 12], appliesTo: [1] },
    ],
  };
  const { json } = transformList(input);
  const slots = json.sections[0].formations[0].loadout_slots;
  assert.strictEqual(slots.length, 2);
  assert.notStrictEqual(slots[0].string_id, slots[1].string_id);
});

test('high-confidence default heuristic: cheapest wins; first-in-from breaks ties', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-loadouts.mjs')).href;
  const { transformList } = await import(url);
  const input = {
    id: 'Tiebreak', list_id: 'TIE',
    sections: [{ name: 'CORE', formations: [{ string_id: 'f', id: 1, name: 'F', pts: 100, cost_pts: 100, upgrades: [] }] }],
    upgrades: [
      { id: 20, string_id: 'first_cheap', name: 'First Cheap', pts: 0 },
      { id: 21, string_id: 'second_cheap', name: 'Second Cheap', pts: 0 },  // also 0
      { id: 22, string_id: 'expensive', name: 'Expensive', pts: 50 },
    ],
    upgradeConstraints: [{ min: 2, max: 2, from: [22, 21, 20], appliesTo: [1] }],
  };
  // Variants ordered [22, 21, 20]: cheapest are 21 and 20 (both 0). First listed in `from[]`
  // among those is 21. So default should be 21.
  const { json } = transformList(input);
  const slot = json.sections[0].formations[0].loadout_slots[0];
  const defaultVariant = slot.variants.find((v) => v.is_default);
  assert.strictEqual(defaultVariant.upgrade_id, 21);
});
