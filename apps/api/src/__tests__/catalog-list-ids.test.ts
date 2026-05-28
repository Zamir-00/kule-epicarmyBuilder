import { test } from 'node:test';
import assert from 'node:assert';
import { getValidListIds, invalidateListIdCache } from '../catalog/list-ids.js';

test('getValidListIds returns a non-empty Set', async () => {
  invalidateListIdCache();
  const ids = await getValidListIds();
  assert.ok(ids instanceof Set, 'should be a Set');
  assert.ok(ids.size > 0, 'should have at least one entry');
});

test('getValidListIds contains known list_ids', async () => {
  invalidateListIdCache();
  const ids = await getValidListIds();
  assert.ok(ids.has('CHAOS_dg_NETEA'), 'should contain CHAOS_dg_NETEA');
  assert.ok(ids.has('SM_codex_NETEA'), 'should contain SM_codex_NETEA');
});

test('getValidListIds does NOT contain non-list filenames like TEMPLATE', async () => {
  invalidateListIdCache();
  const ids = await getValidListIds();
  // The filenames themselves (without .json) should not appear as list_ids
  // unless a JSON file actually has a list_id field equal to that value
  assert.ok(!ids.has('TEMPLATE'), 'should not contain TEMPLATE as a list_id');
});
