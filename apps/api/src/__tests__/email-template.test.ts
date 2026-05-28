import { test } from 'node:test';
import assert from 'node:assert';
import { magicLinkEmail } from '../auth/email-templates.js';

test('magicLinkEmail builds a URL with the token query param', () => {
  const t = magicLinkEmail({ baseUrl: 'https://example.com', token: 'AbC-1_2' });
  assert.match(t.text, /https:\/\/example\.com\/sign-in\?token=AbC-1_2/);
});

test('magicLinkEmail URL-encodes the token', () => {
  const t = magicLinkEmail({ baseUrl: 'https://example.com', token: 'a+b/c=d' });
  // encodeURIComponent('a+b/c=d') = 'a%2Bb%2Fc%3Dd'
  assert.match(t.text, /token=a%2Bb%2Fc%3Dd/);
});

test('magicLinkEmail mentions 15-minute expiry', () => {
  const t = magicLinkEmail({ baseUrl: 'https://example.com', token: 'x' });
  assert.match(t.text, /15 minutes/);
  assert.match(t.html, /15 minutes/);
});

test('magicLinkEmail escapes HTML in URL', () => {
  // baseUrl with chars that need HTML escaping
  const t = magicLinkEmail({ baseUrl: 'https://example.com', token: 'a&b<c>' });
  assert.ok(!t.html.includes('a&b<c>'), 'raw special chars must not appear unescaped');
  assert.match(t.html, /token=a%26b%3Cc%3E/);  // URL-encoded in URL
});

test('magicLinkEmail subject is non-empty', () => {
  const t = magicLinkEmail({ baseUrl: 'https://example.com', token: 'x' });
  assert.ok(t.subject.length > 0);
});
