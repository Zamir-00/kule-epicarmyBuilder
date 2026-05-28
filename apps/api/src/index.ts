import Fastify from 'fastify';
import { env } from './env.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  return app;
}

// Only listen when this file is run directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildApp();
  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
