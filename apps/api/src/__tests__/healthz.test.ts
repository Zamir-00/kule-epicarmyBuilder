import { test } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../index.js';

test('GET /healthz returns 200 and status ok', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/healthz' });
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(JSON.parse(response.body), { status: 'ok' });
  await app.close();
});
