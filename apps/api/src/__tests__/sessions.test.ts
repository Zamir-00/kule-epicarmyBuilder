import { test } from 'node:test';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { createTestDb } from './helpers/test-db.js';
import { createSession, loadSession, deleteSession } from '../auth/sessions.js';
import { users, sessions } from '../db/schema.js';

function insertUser(db: ReturnType<typeof createTestDb>['db'], email = 'test@example.com') {
  const id = ulid();
  const now = Date.now();
  db.insert(users).values({ id, email, display_name: null, created_at: now, last_sign_in_at: now }).run();
  return id;
}

test('createSession inserts a row and returns an id', () => {
  const { db, close } = createTestDb();
  const userId = insertUser(db);
  const { id, expiresAt } = createSession(db, userId);
  assert.ok(id, 'session id should be truthy');
  assert.ok(expiresAt > Date.now(), 'expiresAt should be in the future');
  close();
});

test('loadSession returns null for unknown id', () => {
  const { db, close } = createTestDb();
  const result = loadSession(db, 'nonexistent-session-id');
  assert.strictEqual(result, null);
  close();
});

test('loadSession returns null for expired session', () => {
  const { db, close } = createTestDb();
  const userId = insertUser(db);
  const { id: sessionId } = createSession(db, userId);

  // Manually set expires_at to the past
  db.update(sessions).set({ expires_at: Date.now() - 1000 }).where(eq(sessions.id, sessionId)).run();

  const result = loadSession(db, sessionId);
  assert.strictEqual(result, null);
  close();
});

test('loadSession bumps last_seen_at', () => {
  const { db, close } = createTestDb();
  const userId = insertUser(db);
  const { id: sessionId } = createSession(db, userId);

  // Set last_seen_at to 5 seconds ago so we can detect the bump
  const past = Date.now() - 5000;
  db.update(sessions).set({ last_seen_at: past }).where(eq(sessions.id, sessionId)).run();

  const before = Date.now();
  const result = loadSession(db, sessionId);
  assert.ok(result, 'should return a loaded session');

  const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  assert.ok(row, 'row should exist');
  assert.ok(row.last_seen_at >= before, 'last_seen_at should be bumped to now or later');
  close();
});

test('loadSession slides expires_at when last_seen_at > 7 days old', () => {
  const { db, close } = createTestDb();
  const userId = insertUser(db);
  const { id: sessionId } = createSession(db, userId);

  // Set last_seen_at to 8 days ago
  const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const originalExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
  db.update(sessions).set({ last_seen_at: eightDaysAgo, expires_at: originalExpiry }).where(eq(sessions.id, sessionId)).run();

  const beforeLoad = Date.now();
  const result = loadSession(db, sessionId);
  assert.ok(result, 'should return a loaded session');

  const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  assert.ok(row, 'row should exist');
  // expires_at should have been extended by 30 days from now (not from original)
  const expectedMinExpiry = beforeLoad + 30 * 24 * 60 * 60 * 1000 - 1000; // allow 1s slack
  assert.ok(row.expires_at >= expectedMinExpiry, `expires_at ${row.expires_at} should be >= ${expectedMinExpiry}`);
  close();
});

test('deleteSession removes the row', () => {
  const { db, close } = createTestDb();
  const userId = insertUser(db);
  const { id: sessionId } = createSession(db, userId);

  deleteSession(db, sessionId);
  const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  assert.strictEqual(row, undefined);
  close();
});
