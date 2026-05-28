import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { env } from './env.js';
import { WAR_ROOT } from './paths.js';
import { registerStaticRoutes } from './static/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  // Explicit redirect: war/index.html is a menu page, not a redirect to chooser.html
  app.get('/', async (_req, reply) => {
    reply.redirect('/chooser.html', 302);
  });

  // Register /data/* routes BEFORE static-file plugin so they don't fall through to a file lookup
  await registerStaticRoutes(app);

  // Static last; serves war/* at /*
  await app.register(fastifyStatic, {
    root: WAR_ROOT,
    prefix: '/',
    cacheControl: false,
    decorateReply: false,
  });

  return app;
}

// Only listen when this file is run directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildApp();
  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
