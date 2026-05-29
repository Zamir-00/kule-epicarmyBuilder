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
