import { test } from 'node:test';
import assert from 'node:assert';
import { ulid } from 'ulid';
import { eq } from 'drizzle-orm';
import { createTestDb } from './helpers/test-db.js';
import { users, sessions, userLists, magicLinkTokens } from '../db/schema.js';

test('schema: can insert and read a user', () => {
  const { db, close } = createTestDb();
  const id = ulid();
  db.insert(users).values({
    id, email: 'a@example.com', display_name: null,
    created_at: Date.now(), last_sign_in_at: null,
  }).run();
  const found = db.select().from(users).where(eq(users.id, id)).get();
  assert.ok(found);
  assert.strictEqual(found.email, 'a@example.com');
  close();
});

test('schema: email is unique', () => {
  const { db, close } = createTestDb();
  db.insert(users).values({ id: ulid(), email: 'a@example.com', created_at: Date.now() }).run();
  assert.throws(
    () => db.insert(users).values({ id: ulid(), email: 'a@example.com', created_at: Date.now() }).run(),
    /UNIQUE/i
  );
  close();
});

test('schema: deleting a user cascades to sessions', () => {
  const { db, close } = createTestDb();
  const uid = ulid();
  db.insert(users).values({ id: uid, email: 'a@example.com', created_at: Date.now() }).run();
  const sid = ulid();
  db.insert(sessions).values({
    id: sid, user_id: uid,
    created_at: Date.now(), expires_at: Date.now() + 1000, last_seen_at: Date.now(),
  }).run();

  db.delete(users).where(eq(users.id, uid)).run();
  const remaining = db.select().from(sessions).where(eq(sessions.id, sid)).get();
  assert.strictEqual(remaining, undefined);
  close();
});

test('schema: deleting a user cascades to user_lists', () => {
  const { db, close } = createTestDb();
  const uid = ulid();
  db.insert(users).values({ id: uid, email: 'a@example.com', created_at: Date.now() }).run();
  db.insert(userLists).values({
    id: ulid(), owner_id: uid, title: 'My list', list_id: 'CHAOS_dg_NETEA',
    body: { selections: [] }, is_public: false,
    created_at: Date.now(), updated_at: Date.now(),
  }).run();

  db.delete(users).where(eq(users.id, uid)).run();
  const remaining = db.select().from(userLists).get();
  assert.strictEqual(remaining, undefined);
  close();
});

test('schema: magic_link_tokens stores hash as primary key', () => {
  const { db, close } = createTestDb();
  const hash = 'a'.repeat(64);  // simulate sha256 hex
  db.insert(magicLinkTokens).values({
    token_hash: hash,
    email: 'a@example.com',
    created_at: Date.now(),
    expires_at: Date.now() + 900_000,
    consumed_at: null,
  }).run();
  assert.throws(
    () => db.insert(magicLinkTokens).values({
      token_hash: hash, email: 'b@example.com',
      created_at: Date.now(), expires_at: Date.now(),
    }).run(),
    /UNIQUE|primary key/i
  );
  close();
});

test('schema: user_lists.body persists as JSON', () => {
  const { db, close } = createTestDb();
  const uid = ulid();
  db.insert(users).values({ id: uid, email: 'a@example.com', created_at: Date.now() }).run();
  const lid = ulid();
  const body = { selections: [{ formation_id: 'plague_marine_retinue', upgrades: ['vectorium_lord'] }] };
  db.insert(userLists).values({
    id: lid, owner_id: uid, title: 'x', list_id: 'CHAOS_dg_NETEA',
    body, is_public: false,
    created_at: Date.now(), updated_at: Date.now(),
  }).run();
  const found = db.select().from(userLists).where(eq(userLists.id, lid)).get();
  assert.ok(found);
  assert.deepStrictEqual(found.body, body);
  close();
});
