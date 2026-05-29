import { test } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../index.js';

test('GET / redirects to /v2/ (SPA is the default)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/' });
  assert.strictEqual(r.statusCode, 303);
  assert.strictEqual(r.headers['location'], '/v2/');
  await app.close();
});

test('GET /index.html still serves the legacy ruleset nav menu', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/index.html' });
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.headers['content-type'] as string, /text\/html/);
  assert.match(r.body, /indexNETEA\.html|indexGW\.html/);
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

test('GET /data/lists returns an array of list metadata', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/lists' });
  assert.strictEqual(r.statusCode, 200);
  const data = JSON.parse(r.body);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 100, `expected >= 100 list entries, got ${data.length}`);
  const dg = data.find((e: any) => e.list_id === 'CHAOS_dg_NETEA');
  assert.ok(dg, 'CHAOS_dg_NETEA should be in the index');
  assert.strictEqual(dg.ruleset, 'NETEA');
  await app.close();
});

test('GET /data/lists assigns faction_group to every entry', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/lists' });
  assert.strictEqual(r.statusCode, 200);
  const data = JSON.parse(r.body) as Array<{ list_id: string; faction_group: string }>;
  for (const e of data) {
    assert.ok(
      typeof e.faction_group === 'string' && e.faction_group.length > 0,
      `entry ${e.list_id} missing faction_group`,
    );
  }
  const sm = data.find((e) => e.list_id.startsWith('SM_'));
  assert.ok(sm, 'expected at least one SM_* list');
  assert.strictEqual(sm!.faction_group, 'Space Marines');
  const chaos = data.find((e) => e.list_id === 'CHAOS_dg_NETEA');
  assert.strictEqual(chaos!.faction_group, 'Chaos');
  await app.close();
});

test('GET /data/source-for-list/CHAOS_dg_NETEA returns the death-guard source-json', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/source-for-list/CHAOS_dg_NETEA' });
  assert.strictEqual(r.statusCode, 200);
  const parsed = JSON.parse(r.body);
  assert.strictEqual(parsed?.metadata?.list_id, 'CHAOS_dg_NETEA');
  assert.ok(Array.isArray(parsed.profiles), 'expected profiles array');
  await app.close();
});

test('GET /data/source-for-list/<unmapped-list> returns 404', async () => {
  const app = await buildApp();
  // Pick a list_id that has no source-json mapping: ORK_feral
  const r = await app.inject({ method: 'GET', url: '/data/source-for-list/ORK_feral' });
  assert.strictEqual(r.statusCode, 404);
  await app.close();
});

test('GET /data/source-for-list with invalid id is rejected', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/data/source-for-list/has%20space' });
  assert.ok(r.statusCode === 400 || r.statusCode === 404, `expected 4xx, got ${r.statusCode}`);
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
