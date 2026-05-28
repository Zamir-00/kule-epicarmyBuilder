import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import { env } from './env.js';
import { WAR_ROOT } from './paths.js';
import { registerStaticRoutes } from './static/routes.js';
import { db } from './db/client.js';
import { createConsoleTransport, createResendTransport } from './auth/email.js';
import { setSessionCookie } from './auth/cookie.js';
import { hashToken } from './auth/magic-link.js';
import { eq } from 'drizzle-orm';
import { magicLinkTokens, users, type User } from './db/schema.js';
import { ulid } from 'ulid';
import { createSession } from './auth/sessions.js';
import { appRouter, type AppRouter } from './trpc/index.js';
import { buildContextFactory, type TrpcDeps } from './trpc/context.js';

export interface BuildAppOpts {
  deps: TrpcDeps;
}

function chooseEmailTransport() {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return createResendTransport(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return createConsoleTransport();
}

export async function buildApp(opts?: BuildAppOpts) {
  const deps: TrpcDeps = opts?.deps ?? {
    db,
    emailTransport: chooseEmailTransport(),
    baseUrl: env.BASE_URL,
  };

  const app = Fastify({ logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' } });

  app.get('/healthz', async () => ({ status: 'ok' }));

  // Root redirect
  app.get('/', async (req, reply) => {
    reply.code(302).header('location', '/chooser.html').send();
  });

  await registerStaticRoutes(app);

  // tRPC
  await app.register(fastifyTRPCPlugin<AppRouter>, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: buildContextFactory(deps),
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  });

  // /sign-in?token=...  — magic-link landing
  app.get<{ Querystring: { token?: string } }>('/sign-in', async (req, reply) => {
    const token = req.query.token;
    if (!token) { reply.code(400).send('missing token'); return; }
    const hash = hashToken(token);
    const row = deps.db.select().from(magicLinkTokens).where(eq(magicLinkTokens.token_hash, hash)).get();
    const now = Date.now();

    if (!row || row.consumed_at !== null || row.expires_at < now) {
      reply.code(400).send('invalid or expired token');
      return;
    }

    deps.db.update(magicLinkTokens).set({ consumed_at: now }).where(eq(magicLinkTokens.token_hash, hash)).run();

    let user: User | undefined = deps.db.select().from(users).where(eq(users.email, row.email)).get();
    if (!user) {
      const id = ulid();
      deps.db.insert(users).values({ id, email: row.email, display_name: null, created_at: now, last_sign_in_at: now }).run();
      user = deps.db.select().from(users).where(eq(users.id, id)).get();
    } else {
      deps.db.update(users).set({ last_sign_in_at: now }).where(eq(users.id, user.id)).run();
    }
    if (!user) { reply.code(500).send('user creation failed'); return; }

    const session = createSession(deps.db, user.id, req.headers['user-agent']);
    setSessionCookie(reply, session.id, env.NODE_ENV === 'production');
    reply.code(302).header('location', '/').send();
  });

  // Static last
  await app.register(fastifyStatic, {
    root: WAR_ROOT,
    prefix: '/',
    cacheControl: false,
    decorateReply: false,
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runMigrations } = await import('./db/migrate.js');
  runMigrations(db);
  const app = await buildApp();
  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
