import { test } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../index.js';

test('GET / redirects to /chooser.html', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/' });
  assert.ok(r.statusCode === 302 || r.statusCode === 301, `expected redirect, got ${r.statusCode}`);
  assert.ok(
    (r.headers['location'] as string).includes('chooser.html'),
    `expected location to include chooser.html, got ${r.headers['location']}`
  );
  await app.close();
});

test('GET /chooser.html returns HTML', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/chooser.html' });
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.headers['content-type'] as string, /text\/html/);
  assert.match(r.body, /<html|<!doctype/i);
  await app.close();
});

test('GET /data/source-json/death-guard.json returns the file with cache header', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/source-json/death-guard.json' });
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.headers['content-type'] as string, /application\/json/);
  assert.match(r.headers['cache-control'] as string, /max-age=300/);
  const parsed = JSON.parse(r.body);
  assert.ok(parsed.metadata, 'death-guard.json should have a metadata object');
  await app.close();
});

test('GET /data/source-json/nonexistent.json returns 404', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/source-json/nonexistent.json' });
  assert.strictEqual(r.statusCode, 404);
  await app.close();
});

test('GET /data/source-json/../../../etc/passwd is rejected', async () => {
  const app = await buildApp();
  // Fastify route param won't allow slashes, but try URL-encoded
  const r = await app.inject({ method: 'GET', url: '/data/source-json/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd' });
  assert.ok(r.statusCode === 400 || r.statusCode === 404, `expected 4xx, got ${r.statusCode}`);
  assert.ok(!r.body.includes('root:'), 'must not serve /etc/passwd');
  await app.close();
});

test('GET /data/source-json/foo.txt is rejected (non-json extension)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/source-json/foo.txt' });
  assert.strictEqual(r.statusCode, 400);
  await app.close();
});

test('GET /data/lists/CHAOS_dg_NETEA.json returns the list with list_id field', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/lists/CHAOS_dg_NETEA.json' });
  assert.strictEqual(r.statusCode, 200);
  const parsed = JSON.parse(r.body);
  assert.strictEqual(parsed.list_id, 'CHAOS_dg_NETEA');
  await app.close();
});

test('GET /data/factions returns the inventory', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/factions' });
  assert.strictEqual(r.statusCode, 200);
  const parsed = JSON.parse(r.body);
  assert.ok(Array.isArray(parsed), 'factions should be an array');
  assert.ok(parsed.length >= 40, `expected ~50 factions, got ${parsed.length}`);
  const deathGuard = parsed.find((e: { slug: string }) => e.slug === 'deathGuard');
  assert.ok(deathGuard, 'deathGuard entry expected');
  assert.strictEqual(deathGuard.status, 'MIGRATED');
  await app.close();
});
