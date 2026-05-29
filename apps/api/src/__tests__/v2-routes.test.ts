import { test } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../index.js';

test('GET /v2 returns the SPA index (200, text/html)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/v2' });
  // If apps/web/dist/index.html exists, expect 200 + HTML.
  // If not, expect 503 with a friendly message.
  if (r.statusCode === 200) {
    assert.match(r.headers['content-type'] as string, /text\/html/);
    assert.match(r.body, /<html|<div id="root"/i);
  } else {
    assert.strictEqual(r.statusCode, 503);
    assert.match(r.body, /not built/i);
  }
  await app.close();
});

test('GET /v2/some/spa/route returns index.html (SPA fallback)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/v2/build/CHAOS_dg_NETEA' });
  if (r.statusCode === 200) {
    assert.match(r.headers['content-type'] as string, /text\/html/);
  } else {
    assert.strictEqual(r.statusCode, 503);
  }
  await app.close();
});

test('GET /v2/assets/<file-that-does-not-exist> returns 404 (not the fallback)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/v2/assets/nonexistent-12345.js' });
  // 404 (file missing) or 503 (spa not built) are both acceptable; the key is "not 200 with HTML"
  assert.ok(r.statusCode === 404 || r.statusCode === 503, `expected 404 or 503, got ${r.statusCode}`);
  if (r.statusCode === 200) {
    assert.fail('asset path must not fall through to the SPA index');
  }
  await app.close();
});

test('GET /v2/assets/../../../etc/passwd is rejected (traversal guard)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/v2/assets/%2E%2E%2F%2E%2E%2F%2E%2E%2Fetc%2Fpasswd' });
  assert.ok(r.statusCode === 400 || r.statusCode === 404 || r.statusCode === 503,
    `expected 4xx/503, got ${r.statusCode}`);
  assert.ok(!r.body.includes('root:'), 'must not leak /etc/passwd');
  await app.close();
});

test('GET / still returns 200 + legacy nav (no regression)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/' });
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.headers['content-type'] as string, /text\/html/);
  assert.match(r.body, /indexNETEA\.html|indexGW\.html/);
  await app.close();
});
