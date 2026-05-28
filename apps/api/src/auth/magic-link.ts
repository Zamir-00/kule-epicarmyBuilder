import { createHash, randomBytes } from 'node:crypto';

/** Generate a 32-byte URL-safe random token (raw, will be emailed to user). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex hash. We store this, never the raw token. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
