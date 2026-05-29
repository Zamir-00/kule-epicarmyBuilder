import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildTestApp, type TestTrpcClient } from '../helpers/build-test-app.js';
import type { InProcessEmails } from '../helpers/in-process-emails.js';
import { invalidateListIdCache } from '../../catalog/list-ids.js';
import { invalidateListCatalogCache } from '../../catalog/list-catalog.js';
import { WAR_ROOT } from '../../paths.js';

// Reset the list-id cache before all tests so we read fresh from disk
invalidateListIdCache();

const VALID_LIST_ID = 'CHAOS_dg_NETEA';
const SAMPLE_BODY = { units: [], notes: 'test' };

async function signInUser(trpc: TestTrpcClient, emails: InProcessEmails, email = 'a@example.com') {
  await trpc.auth.requestMagicLink.mutate({ email });
  const url = new URL(emails.last().text.match(/https?:\/\/\S+/)![0]);
  const token = url.searchParams.get('token')!;
  const { sessionId } = await trpc.auth.verifyMagicLink.mutate({ token });
  emails.clear();
  return { sessionId, authed: trpc.withSession(sessionId) };
}

test('save creates a new list', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  const result = await authed.lists.save.mutate({
    title: 'My Death Guard List',
    list_id: VALID_LIST_ID,
    body: SAMPLE_BODY,
  });

  assert.ok(result.id, 'id should be set');
  assert.ok(result.created_at > 0, 'created_at should be set');
  assert.strictEqual(result.is_public, false, 'is_public defaults to false');
  assert.strictEqual(result.list_id, VALID_LIST_ID, 'list_id matches input');
  assert.strictEqual(result.title, 'My Death Guard List');
  close();
});

test('save with id updates an existing list', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  const created = await authed.lists.save.mutate({
    title: 'Original Title',
    list_id: VALID_LIST_ID,
    body: SAMPLE_BODY,
  });

  // Wait a tick so updated_at differs
  await new Promise(r => setTimeout(r, 5));

  const updated = await authed.lists.save.mutate({
    id: created.id,
    title: 'Updated Title',
    list_id: VALID_LIST_ID,
    body: { units: [{ name: 'Plague Marines' }] },
  });

  assert.strictEqual(updated.id, created.id, 'id unchanged');
  assert.strictEqual(updated.title, 'Updated Title', 'title updated');
  assert.ok(updated.updated_at >= created.updated_at, 'updated_at bumped');
  close();
});

test('save with unknown list_id throws BAD_REQUEST', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  await assert.rejects(
    () => authed.lists.save.mutate({
      title: 'Test',
      list_id: 'NOT_A_REAL_LIST_ID',
      body: {},
    }),
    /list_id not found in catalog/,
  );
  close();
});

test('save with id owned by different user throws NOT_FOUND', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed: authedA } = await signInUser(trpc, emails, 'a@example.com');
  const { authed: authedB } = await signInUser(trpc, emails, 'b@example.com');

  const created = await authedA.lists.save.mutate({
    title: 'A list',
    list_id: VALID_LIST_ID,
    body: {},
  });

  await assert.rejects(
    () => authedB.lists.save.mutate({
      id: created.id,
      title: 'Hijacked',
      list_id: VALID_LIST_ID,
      body: {},
    }),
    /NOT_FOUND|list not found/,
  );
  close();
});

test('save with non-existent id throws NOT_FOUND', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  await assert.rejects(
    () => authed.lists.save.mutate({
      id: '01HXXXXXXXXXXXXXXXXXXXXXXX',
      title: 'Ghost',
      list_id: VALID_LIST_ID,
      body: {},
    }),
    /NOT_FOUND|list not found/,
  );
  close();
});

test('load own private list works for the owner', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  const created = await authed.lists.save.mutate({
    title: 'Private List',
    list_id: VALID_LIST_ID,
    body: SAMPLE_BODY,
    is_public: false,
  });

  const loaded = await authed.lists.load.query({ id: created.id });
  assert.strictEqual(loaded.id, created.id);
  assert.strictEqual(loaded.title, 'Private List');
  close();
});

test('load other user public list works without auth', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  const created = await authed.lists.save.mutate({
    title: 'Public List',
    list_id: VALID_LIST_ID,
    body: SAMPLE_BODY,
    is_public: true,
  });

  // Load via unauthenticated trpc (no withSession)
  const loaded = await trpc.lists.load.query({ id: created.id });
  assert.strictEqual(loaded.id, created.id);
  assert.strictEqual(loaded.is_public, true);
  close();
});

test('load other user private list throws NOT_FOUND without auth', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  const created = await authed.lists.save.mutate({
    title: 'Private List',
    list_id: VALID_LIST_ID,
    body: SAMPLE_BODY,
    is_public: false,
  });

  // Unauthenticated load of a private list
  await assert.rejects(
    () => trpc.lists.load.query({ id: created.id }),
    /NOT_FOUND|list not found/,
  );
  close();
});

test('load missing id throws NOT_FOUND', async () => {
  const { trpc, close } = buildTestApp();

  await assert.rejects(
    () => trpc.lists.load.query({ id: '01HXXXXXXXXXXXXXXXXXXXXXXX' }),
    /NOT_FOUND|list not found/,
  );
  close();
});

test('listMine returns only the caller lists sorted by updated_at DESC', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed: authedA } = await signInUser(trpc, emails, 'a@example.com');
  const { authed: authedB } = await signInUser(trpc, emails, 'b@example.com');

  // A creates two lists
  const a1 = await authedA.lists.save.mutate({ title: 'A List 1', list_id: VALID_LIST_ID, body: {} });
  await new Promise(r => setTimeout(r, 5));
  const a2 = await authedA.lists.save.mutate({ title: 'A List 2', list_id: VALID_LIST_ID, body: {} });

  // B creates one list
  await authedB.lists.save.mutate({ title: 'B List 1', list_id: VALID_LIST_ID, body: {} });

  const { items } = await authedA.lists.listMine.query({});

  assert.strictEqual(items.length, 2, 'A should see exactly 2 lists');
  assert.strictEqual(items[0]!.id, a2.id, 'most recently updated first');
  assert.strictEqual(items[1]!.id, a1.id, 'older list second');
  close();
});

test('listMine pagination via cursor works correctly', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  // Save 3 lists with slight time gaps for stable ordering
  const l1 = await authed.lists.save.mutate({ title: 'List 1', list_id: VALID_LIST_ID, body: {} });
  await new Promise(r => setTimeout(r, 5));
  const l2 = await authed.lists.save.mutate({ title: 'List 2', list_id: VALID_LIST_ID, body: {} });
  await new Promise(r => setTimeout(r, 5));
  const l3 = await authed.lists.save.mutate({ title: 'List 3', list_id: VALID_LIST_ID, body: {} });

  // First page: limit 2, should return l3, l2
  const page1 = await authed.lists.listMine.query({ limit: 2 });
  assert.strictEqual(page1.items.length, 2);
  assert.strictEqual(page1.items[0]!.id, l3.id, 'page1[0] is newest');
  assert.strictEqual(page1.items[1]!.id, l2.id, 'page1[1] is second');
  assert.ok(page1.nextCursor !== null, 'should have a next cursor');

  // Second page: use cursor, should return l1
  const page2 = await authed.lists.listMine.query({ limit: 2, cursor: page1.nextCursor! });
  assert.strictEqual(page2.items.length, 1);
  assert.strictEqual(page2.items[0]!.id, l1.id, 'page2[0] is oldest');
  assert.strictEqual(page2.nextCursor, null, 'no more pages');

  // Suppress unused variable warnings
  void l1;
  close();
});

test('setVisibility owner-only check — non-owner gets NOT_FOUND', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed: authedA } = await signInUser(trpc, emails, 'a@example.com');
  const { authed: authedB } = await signInUser(trpc, emails, 'b@example.com');

  const created = await authedA.lists.save.mutate({
    title: 'A private',
    list_id: VALID_LIST_ID,
    body: {},
  });

  await assert.rejects(
    () => authedB.lists.setVisibility.mutate({ id: created.id, is_public: true }),
    /NOT_FOUND|list not found/,
  );
  close();
});

test('delete owner-only check — non-owner gets NOT_FOUND', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed: authedA } = await signInUser(trpc, emails, 'a@example.com');
  const { authed: authedB } = await signInUser(trpc, emails, 'b@example.com');

  const created = await authedA.lists.save.mutate({
    title: 'A list',
    list_id: VALID_LIST_ID,
    body: {},
  });

  await assert.rejects(
    () => authedB.lists.delete.mutate({ id: created.id }),
    /NOT_FOUND|list not found/,
  );
  close();
});

test('delete makes subsequent load throw NOT_FOUND', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  const created = await authed.lists.save.mutate({
    title: 'Doomed List',
    list_id: VALID_LIST_ID,
    body: {},
    is_public: true,
  });

  const deleteResult = await authed.lists.delete.mutate({ id: created.id });
  assert.strictEqual(deleteResult.ok, true);

  await assert.rejects(
    () => trpc.lists.load.query({ id: created.id }),
    /NOT_FOUND|list not found/,
  );
  close();
});

test('save validates body size — body >256KB throws PAYLOAD_TOO_LARGE', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  // Create a body that serializes to more than 256KB
  const bigBody = { data: 'x'.repeat(256 * 1024 + 1) };

  await assert.rejects(
    () => authed.lists.save.mutate({
      title: 'Big List',
      list_id: VALID_LIST_ID,
      body: bigBody,
    }),
    /PAYLOAD_TOO_LARGE|exceeds/,
  );
  close();
});

test('save with empty title rejects with validation error', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);

  await assert.rejects(
    () => authed.lists.save.mutate({
      title: '',
      list_id: VALID_LIST_ID,
      body: {},
    }),
    // Zod will reject with a validation error
    (err: unknown) => {
      const message = String(err);
      // tRPC wraps zod errors — match on common patterns
      return message.includes('too_small') || message.includes('String must contain') || message.includes('min') || message.includes('BAD_REQUEST');
    },
  );
  close();
});

// ---- swap_choices validation tests ----

const TEST_LIST_ID = 'TEST_swap_fixture';
const TEST_FIXTURE_PATH = path.join(WAR_ROOT, 'lists', `${TEST_LIST_ID}.json`);
const TEST_FIXTURE = {
  id: 'TEST swap fixture',
  list_id: TEST_LIST_ID,
  sections: [
    {
      name: 'CORE',
      formations: [
        {
          string_id: 'demi',
          id: 1,
          name: 'Demi-Century',
          pts: 250,
          cost_pts: 250,
          upgrades: [10],
          swap_slots: [
            {
              string_id: 'support',
              label: 'Support unit',
              variants: [
                { upgrade_id: 100, is_default: true },
                { upgrade_id: 101 },
              ],
            },
          ],
        },
      ],
    },
  ],
  upgrades: [
    { id: 10, string_id: 'hydra', name: 'Hydra', pts: 50 },
    { id: 100, string_id: 'gun_servitors', name: 'Gun Servitors', pts: 0 },
    { id: 101, string_id: 'rapier_lasers', name: 'Rapier Lasers', pts: 30 },
  ],
};

async function ensureTestFixture() {
  await fs.writeFile(TEST_FIXTURE_PATH, JSON.stringify(TEST_FIXTURE, null, 2), 'utf8');
  invalidateListIdCache();
  invalidateListCatalogCache();
}

async function removeTestFixture() {
  try { await fs.unlink(TEST_FIXTURE_PATH); } catch { /* ignore */ }
  invalidateListIdCache();
  invalidateListCatalogCache();
}

test('save accepts a valid swap_choices body', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    const result = await authed.lists.save.mutate({
      title: 'Swap test',
      list_id: TEST_LIST_ID,
      body: {
        body_version: 2,
        formations: [{
          instance_id: '01HSWAPTEST',
          formation_string_id: 'demi',
          upgrade_string_ids: [],
          swap_choices: { support: 'rapier_lasers' },
        }],
      },
    });
    assert.ok(result.id);
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects swap_choices key that is not a slot on the formation', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad slot',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 2,
          formations: [{
            instance_id: '01HSWAPBAD1',
            formation_string_id: 'demi',
            upgrade_string_ids: [],
            swap_choices: { nonexistent_slot: 'rapier_lasers' },
          }],
        },
      }),
      /nonexistent_slot|unknown swap slot|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects swap_choices value that is not a valid variant', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad variant',
        list_id: TEST_LIST_ID,
        body: {
          body_version: 2,
          formations: [{
            instance_id: '01HSWAPBAD2',
            formation_string_id: 'demi',
            upgrade_string_ids: [],
            swap_choices: { support: 'ghost_variant' },
          }],
        },
      }),
      /ghost_variant|invalid variant|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save rejects unknown body_version', async () => {
  await ensureTestFixture();
  try {
    const { trpc, emails, close } = buildTestApp();
    const { authed } = await signInUser(trpc, emails);
    await assert.rejects(
      authed.lists.save.mutate({
        title: 'Bad version',
        list_id: TEST_LIST_ID,
        body: { body_version: 99, formations: [] },
      }),
      /body_version|BAD_REQUEST/i,
    );
    close();
  } finally {
    await removeTestFixture();
  }
});

test('save accepts legacy body (no body_version, no swap_choices)', async () => {
  // No fixture needed — using the existing CHAOS_dg_NETEA from earlier tests.
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);
  const result = await authed.lists.save.mutate({
    title: 'Legacy body',
    list_id: VALID_LIST_ID,
    body: { units: [], notes: 'legacy' },
  });
  assert.ok(result.id);
  close();
});

test('save persists body_version: 2 in the stored body', async () => {
  const { trpc, emails, close } = buildTestApp();
  const { authed } = await signInUser(trpc, emails);
  const created = await authed.lists.save.mutate({
    title: 'Body version round-trip',
    list_id: VALID_LIST_ID,
    body: { body_version: 2, formations: [] },
  });
  const loaded = await authed.lists.load.query({ id: created.id });
  assert.strictEqual((loaded.body as { body_version?: number }).body_version, 2);
  close();
});
