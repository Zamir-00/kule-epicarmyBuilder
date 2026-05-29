'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FIX = path.resolve(__dirname, 'fixtures', 'migrate-swaps');

async function runTransform(fileName) {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-swaps.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, fileName), 'utf8'));
  return transformList(input);
}

test('high-confidence: emits swap_slots and leaves upgradeConstraints in place', async () => {
  const { json, report } = await runTransform('high-confidence-input.json');
  const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-output.json'), 'utf8'));
  assert.deepStrictEqual(json, expected);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'high');
});

test('medium-confidence (mismatched pts): no transform, report row emitted', async () => {
  const { json, report } = await runTransform('medium-confidence-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'medium-confidence-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original, 'medium-confidence inputs must be left untouched');
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].tier, 'medium');
});

test('malformed constraint (single-variant from): no transform, no report row', async () => {
  const { json, report } = await runTransform('skip-input.json');
  const original = JSON.parse(fs.readFileSync(path.join(FIX, 'skip-input.json'), 'utf8'));
  assert.deepStrictEqual(json, original);
  assert.strictEqual(report.length, 0);
});

test('idempotency: running transform twice yields the same result as once', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-swaps.mjs')).href;
  const { transformList } = await import(url);
  const input = JSON.parse(fs.readFileSync(path.join(FIX, 'high-confidence-input.json'), 'utf8'));
  const first = transformList(input);
  const second = transformList(first.json);
  assert.deepStrictEqual(second.json, first.json);
});

test('partial migration: applies to formations missing the slot while leaving already-migrated alone', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-swaps.mjs')).href;
  const { transformList } = await import(url);
  const input = {
    id: 'Partial',
    list_id: 'PARTIAL',
    sections: [
      {
        name: 'CORE',
        formations: [
          {
            string_id: 'f1', id: 1, name: 'F1', pts: 100, cost_pts: 100, upgrades: [],
            // F1 is already migrated:
            swap_slots: [{
              string_id: 'swap_a_or_b',
              label: 'Choice',
              variants: [{ upgrade_id: 100, is_default: true }, { upgrade_id: 101 }],
            }],
          },
          {
            string_id: 'f2', id: 2, name: 'F2', pts: 100, cost_pts: 100, upgrades: [],
            // F2 has no slot yet.
          },
        ],
      },
    ],
    upgrades: [
      { id: 100, string_id: 'a', name: 'A', pts: 0 },
      { id: 101, string_id: 'b', name: 'B', pts: 0 },
    ],
    upgradeConstraints: [
      { min: 1, max: 1, from: [100, 101], appliesTo: [1, 2] },
    ],
  };
  const { json, report } = transformList(input);
  // F2 should now have the slot:
  const f2 = json.sections[0].formations[1];
  assert.ok(Array.isArray(f2.swap_slots) && f2.swap_slots.length === 1, 'F2 should have the slot applied');
  // F1 should still have exactly one slot (no duplicate):
  const f1 = json.sections[0].formations[0];
  assert.strictEqual(f1.swap_slots.length, 1, 'F1 must not get a duplicate slot');
  // Report should have one high row listing only F2:
  const highRows = report.filter((r) => r.tier === 'high');
  assert.strictEqual(highRows.length, 1);
  assert.deepStrictEqual(highRows[0].formationIds, [2]);
});

test('slot string_id is deduped when truncation collision would occur', async () => {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'migrate-swaps.mjs')).href;
  const { transformList } = await import(url);
  // Use upgrade string_ids long enough that two different constraints truncate to the same prefix.
  // Each base is ~40 chars; combined with "swap_" + "_or_" exceeds the 80-char limit.
  const longA = 'a_long_first_upgrade_string_id_aaaaaa';
  const longB1 = 'b_variant_one_long_string_id_xxxxxxx';
  const longB2 = 'b_variant_two_long_string_id_xxxxxxx';
  // Without dedupe, slice(0,80) of "swap_<longA>_or_<longB1>" and "swap_<longA>_or_<longB2>"
  // both produce "swap_a_long_first_upgrade_string_id_aaaaaa_or_b_variant_one_long_string_id_xxxx"
  // (truncated at char 80) — identical!
  const input = {
    id: 'Truncation', list_id: 'TRUNC',
    sections: [{ name: 'CORE', formations: [{ string_id: 'f1', id: 1, name: 'F1', pts: 100, cost_pts: 100, upgrades: [] }] }],
    upgrades: [
      { id: 100, string_id: longA, name: 'A', pts: 0 },
      { id: 101, string_id: longB1, name: 'B1', pts: 0 },
      { id: 102, string_id: longB2, name: 'B2', pts: 0 },
    ],
    upgradeConstraints: [
      { min: 1, max: 1, from: [100, 101], appliesTo: [1] },
      { min: 1, max: 1, from: [100, 102], appliesTo: [1] },
    ],
  };
  const { json } = transformList(input);
  const slots = json.sections[0].formations[0].swap_slots;
  assert.strictEqual(slots.length, 2);
  assert.notStrictEqual(slots[0].string_id, slots[1].string_id, 'slot string_ids must be unique within the formation');
});
