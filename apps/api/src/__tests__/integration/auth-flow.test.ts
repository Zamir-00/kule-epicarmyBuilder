import { test } from 'node:test';
import assert from 'node:assert';
import { buildTestApp } from '../helpers/build-test-app.js';

test('full magic-link sign-in flow', async () => {
  const { trpc, emails, close } = buildTestApp();

  await trpc.auth.requestMagicLink.mutate({ email: 'a@example.com' });
  assert.strictEqual(emails.count(), 1);
  const text = emails.last().text;
  const urlMatch = text.match(/https?:\/\/\S+/);
  assert.ok(urlMatch);
  const url = new URL(urlMatch[0]);
  const token = url.searchParams.get('token');
  assert.ok(token);

  const result = await trpc.auth.verifyMagicLink.mutate({ token });
  assert.ok(result.sessionId);

  const authed = trpc.withSession(result.sessionId);
  const me = await authed.auth.me.query() as { email: string };
  assert.strictEqual(me.email, 'a@example.com');
  close();
});

test('requestMagicLink rate-limit: second call within 60s returns ok but no new email', async () => {
  const { trpc, emails, close } = buildTestApp();
  await trpc.auth.requestMagicLink.mutate({ email: 'a@example.com' });
  assert.strictEqual(emails.count(), 1);

  await trpc.auth.requestMagicLink.mutate({ email: 'a@example.com' });
  assert.strictEqual(emails.count(), 1);  // still only one
  close();
});

test('verifyMagicLink fails on already-consumed token', async () => {
  const { trpc, emails, close } = buildTestApp();
  await trpc.auth.requestMagicLink.mutate({ email: 'a@example.com' });
  const text = emails.last().text;
  const url = new URL(text.match(/https?:\/\/\S+/)![0]);
  const token = url.searchParams.get('token')!;

  await trpc.auth.verifyMagicLink.mutate({ token });
  await assert.rejects(
    () => trpc.auth.verifyMagicLink.mutate({ token }),
    /invalid or expired/
  );
  close();
});

test('verifyMagicLink fails on bogus token', async () => {
  const { trpc, close } = buildTestApp();
  await assert.rejects(
    () => trpc.auth.verifyMagicLink.mutate({ token: 'this-is-not-a-real-token-but-long-enough' }),
    /invalid or expired/
  );
  close();
});

test('signOut deletes session; subsequent authed call throws UNAUTHORIZED', async () => {
  const { trpc, emails, close } = buildTestApp();
  await trpc.auth.requestMagicLink.mutate({ email: 'a@example.com' });
  const url = new URL(emails.last().text.match(/https?:\/\/\S+/)![0]);
  const token = url.searchParams.get('token')!;
  const { sessionId } = await trpc.auth.verifyMagicLink.mutate({ token });

  const authed = trpc.withSession(sessionId);
  await authed.auth.signOut.mutate();

  const stillAuthed = trpc.withSession(sessionId);
  await assert.rejects(() => stillAuthed.auth.me.query(), /UNAUTHORIZED|sign in required/);
  close();
});

test('me throws UNAUTHORIZED when not signed in', async () => {
  const { trpc, close } = buildTestApp();
  await assert.rejects(() => trpc.auth.me.query(), /UNAUTHORIZED|sign in required/);
  close();
});
