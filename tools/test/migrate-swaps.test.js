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
