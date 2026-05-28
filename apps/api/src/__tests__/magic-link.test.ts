import { test } from 'node:test';
import assert from 'node:assert';
import { generateToken, hashToken } from '../auth/magic-link.js';

test('generateToken produces URL-safe base64 characters only', () => {
  const token = generateToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test('generateToken length is at least 43 characters', () => {
  const token = generateToken();
  // 32 bytes in base64url = ceil(32 * 4/3) = 43 chars (no padding)
  assert.ok(token.length >= 43, `expected length >= 43, got ${token.length}`);
});

test('10 generated tokens are all distinct', () => {
  const tokens = Array.from({ length: 10 }, () => generateToken());
  const unique = new Set(tokens);
  assert.strictEqual(unique.size, 10);
});

test('hashToken returns consistent SHA-256 hex output', () => {
  const raw = 'test-token';
  const h1 = hashToken(raw);
  const h2 = hashToken(raw);
  assert.strictEqual(h1, h2);
  // SHA-256 hex is 64 chars
  assert.strictEqual(h1.length, 64);
  assert.match(h1, /^[0-9a-f]+$/);
});

test('hashToken produces different hashes for different inputs', () => {
  const h1 = hashToken('token-a');
  const h2 = hashToken('token-b');
  assert.notStrictEqual(h1, h2);
});
