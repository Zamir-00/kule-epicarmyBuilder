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
