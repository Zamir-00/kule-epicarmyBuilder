'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const validatorUrl = pathToFileURL(path.resolve(__dirname, '..', 'validate-lists.mjs')).href;

async function validateFile(fixturePath) {
  const { validateListFile } = await import(validatorUrl);
  return validateListFile(fixturePath);
}

test('validator accepts the swap-slots happy fixture', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'happy.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true, `expected ok=true, got errors: ${JSON.stringify(result.errors)}`);
});

test('rejects swap slot with no default variant', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'missing-default.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /default/i.test(e)), `expected a 'default' error, got: ${result.errors.join('; ')}`);
});

test('rejects swap slot with two default variants', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'two-defaults.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /default/i.test(e)));
});

test('rejects variant upgrade_id not present in top-level upgrades', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'variant-not-in-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /upgrade.*99[0-9]/i.test(e) || /not found/i.test(e)));
});

test('rejects upgrade appearing in both swap variants and formation upgrades', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'variant-also-in-formation-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /double|both|already/i.test(e)));
});

test('rejects duplicate swap-slot string_ids on the same formation', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'swap-slots', 'duplicate-slot-string-ids.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /duplicate|unique/i.test(e)));
});

// --- loadout_slots fixtures ---

test('validator accepts loadout-slots happy fixture', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'happy.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true, `expected ok=true, got: ${JSON.stringify(result.errors)}`);
});

test('validator accepts loadout-slots happy-open fixture (max=3 no default)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'happy-open.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true, `expected ok=true, got: ${JSON.stringify(result.errors)}`);
});

test('validator accepts loadout-slots happy-range fixture (min=2 max=4)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'happy-range.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, true);
});

test('rejects loadout slot where min > max', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'min-greater-than-max.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /min.*max|min <= max|min greater/i.test(e)), `got: ${result.errors.join('; ')}`);
});

test('rejects loadout slot with two default variants', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'two-defaults.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /default/i.test(e)));
});

test('rejects loadout variant upgrade_id not in top-level upgrades', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'variant-not-in-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /not found|upgrade.*999/i.test(e)));
});

test('rejects loadout variant also in formation upgrades[]', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'variant-also-in-formation-upgrades.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /double|both|already/i.test(e)));
});

test('rejects loadout variant overlap with swap_slot variant (cross-system)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'variant-also-in-swap-slot.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /swap_slot|cross-system|both/i.test(e)));
});

test('rejects string_id duplicated across swap_slots and loadout_slots', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'duplicate-string-id-cross-system.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /duplicate|unique/i.test(e)));
});

test('rejects empty loadout variants array (minItems: 1)', async () => {
  const fixture = path.resolve(__dirname, 'fixtures', 'loadout-slots', 'empty-variants.json');
  const result = await validateFile(fixture);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => /minItems|fewer|empty/i.test(e)));
});
