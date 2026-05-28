import { z } from 'zod';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { ulid } from 'ulid';
import { TRPCError } from '@trpc/server';
import { router, procedure, authedProcedure } from './router.js';
import { users, magicLinkTokens, type User } from '../db/schema.js';
import { generateToken, hashToken } from '../auth/magic-link.js';
import { createSession, deleteSession } from '../auth/sessions.js';

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PER_EMAIL_COOLDOWN_MS = 60 * 1000; // 60 seconds between magic links per email

export const authRouter = router({
  requestMagicLink: procedure
    .input(z.object({ email: z.string().email().toLowerCase() }))
    .mutation(async ({ ctx, input }) => {
      const { email } = input;
      const now = Date.now();

      // Rate-limit: count outstanding (unconsumed, unexpired, created in cooldown window) tokens for this email
      const recent = ctx.db.select().from(magicLinkTokens).where(
        and(
          eq(magicLinkTokens.email, email),
          isNull(magicLinkTokens.consumed_at),
          gt(magicLinkTokens.created_at, now - PER_EMAIL_COOLDOWN_MS),
        )
      ).all();

      if (recent.length > 0) {
        // Silently succeed — don't tell the user we already sent one, and don't send another
        return { ok: true as const };
      }

      const raw = generateToken();
      const hash = hashToken(raw);

      ctx.db.insert(magicLinkTokens).values({
        token_hash: hash,
        email,
        created_at: now,
        expires_at: now + TOKEN_TTL_MS,
        consumed_at: null,
      }).run();

      const url = `${ctx.baseUrl}/sign-in?token=${encodeURIComponent(raw)}`;
      await ctx.emailTransport.send({
        to: email,
        subject: 'Sign in to Kule Army Builder',
        text: `Click this link to sign in. It expires in 15 minutes.\n\n${url}\n\nIf you didn't request this, ignore this email.`,
        html: `<p>Click <a href="${url}">this link</a> to sign in. It expires in 15 minutes.</p><p>If you didn't request this, ignore this email.</p>`,
      });

      return { ok: true as const };
    }),

  verifyMagicLink: procedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      const hash = hashToken(input.token);
      const row = ctx.db.select().from(magicLinkTokens).where(eq(magicLinkTokens.token_hash, hash)).get();
      const now = Date.now();

      if (!row || row.consumed_at !== null || row.expires_at < now) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid or expired token' });
      }

      // Mark token consumed
      ctx.db.update(magicLinkTokens).set({ consumed_at: now }).where(eq(magicLinkTokens.token_hash, hash)).run();

      // Upsert user by email
      const email = row.email;
      let user: User | undefined = ctx.db.select().from(users).where(eq(users.email, email)).get();
      if (!user) {
        const id = ulid();
        ctx.db.insert(users).values({
          id,
          email,
          display_name: null,
          created_at: now,
          last_sign_in_at: now,
        }).run();
        user = ctx.db.select().from(users).where(eq(users.id, id)).get();
        if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'user upsert failed' });
      } else {
        ctx.db.update(users).set({ last_sign_in_at: now }).where(eq(users.id, user.id)).run();
      }

      const session = createSession(ctx.db, user.id, ctx.req.headers['user-agent']);
      return { sessionId: session.id, userId: user.id };
    }),

  signOut: authedProcedure
    .mutation(({ ctx }) => {
      if (ctx.sessionId) deleteSession(ctx.db, ctx.sessionId);
      return { ok: true as const };
    }),

  me: authedProcedure
    .query(({ ctx }) => ctx.user),
});
