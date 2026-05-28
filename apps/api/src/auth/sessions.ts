import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import type { Db } from '../db/client.js';
import { sessions, users, type User } from '../db/schema.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SLIDING_EXTENSION_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createSession(db: Db, userId: string, userAgent?: string): { id: string; expiresAt: number } {
  const id = ulid();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  db.insert(sessions).values({
    id,
    user_id: userId,
    created_at: now,
    expires_at: expiresAt,
    last_seen_at: now,
    user_agent: userAgent ?? null,
  }).run();
  return { id, expiresAt };
}

export interface LoadedSession {
  user: User;
  sessionId: string;
}

/** Looks up session by id; if valid, bumps last_seen_at (and slides expires_at when warranted). Returns the user, or null if expired/missing. */
export function loadSession(db: Db, sessionId: string): LoadedSession | null {
  if (!sessionId) return null;
  const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at <= now) {
    // Clean up expired session
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  const user = db.select().from(users).where(eq(users.id, row.user_id)).get();
  if (!user) {
    // Stale session pointing at deleted user — defensive
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  // Bump last_seen_at; slide expires_at if last_seen is old enough
  const updates: { last_seen_at: number; expires_at?: number } = { last_seen_at: now };
  if (now - row.last_seen_at > SLIDING_EXTENSION_THRESHOLD_MS) {
    updates.expires_at = now + SESSION_TTL_MS;
  }
  db.update(sessions).set(updates).where(eq(sessions.id, sessionId)).run();

  return { user, sessionId };
}

export function deleteSession(db: Db, sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}
