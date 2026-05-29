import type { FastifyInstance, FastifyReply } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { WEB_ROOT } from '../paths.js';

const ASSET_CACHE = 'public, max-age=31536000, immutable';
const INDEX_CACHE = 'public, max-age=0, must-revalidate';

async function serveIndex(reply: FastifyReply): Promise<void> {
  if (!WEB_ROOT) {
    reply
      .code(503)
      .header('Content-Type', 'text/plain')
      .send('SPA not built yet. Run `npm run build --workspace apps/web` (and apps/api).');
    return;
  }
  const indexPath = path.join(WEB_ROOT, 'index.html');
  try {
    const html = await fs.readFile(indexPath, 'utf8');
    reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', INDEX_CACHE)
      .send(html);
  } catch {
    reply.code(404).send({ error: 'spa index not found' });
  }
}

function safeAssetPath(name: string): string | null {
  if (!name) return null;
  if (name.includes('..') || name.includes('\0')) return null;
  if (name.startsWith('/')) return null;
  return name;
}

export async function registerV2Routes(app: FastifyInstance): Promise<void> {
  if (!WEB_ROOT) {
    app.log.warn(
      'WEB_ROOT not detected. /v2 routes will return 503 until you build apps/web. ' +
      'Run: npm run build --workspace apps/web'
    );
  }

  // /v2 → index.html
  app.get('/v2', async (_req, reply) => {
    await serveIndex(reply);
  });

  // /v2/assets/* → static asset (immutable cache)
  app.get<{ Params: { '*': string } }>('/v2/assets/*', async (req, reply) => {
    if (!WEB_ROOT) {
      reply.code(503).send({ error: 'spa not built' });
      return;
    }
    const requested = (req.params as { '*': string })['*'];
    const safe = safeAssetPath(requested);
    if (!safe) {
      reply.code(400).send({ error: 'invalid asset path' });
      return;
    }
    const filePath = path.join(WEB_ROOT, 'assets', safe);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(WEB_ROOT, 'assets') + path.sep)) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    try {
      const data = await fs.readFile(resolved);
      // Content-type inferred from extension.
      const ext = path.extname(resolved).toLowerCase();
      const contentType =
        ext === '.js'  ? 'application/javascript; charset=utf-8' :
        ext === '.css' ? 'text/css; charset=utf-8' :
        ext === '.svg' ? 'image/svg+xml' :
        ext === '.png' ? 'image/png' :
        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
        ext === '.woff2' ? 'font/woff2' :
        ext === '.json' ? 'application/json; charset=utf-8' :
        'application/octet-stream';
      reply
        .header('Content-Type', contentType)
        .header('Cache-Control', ASSET_CACHE)
        .send(data);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        reply.code(404).send({ error: 'not found' });
      } else {
        reply.code(500).send({ error: 'read failed' });
      }
    }
  });

  // /v2/* (catchall — SPA fallback)
  app.get('/v2/*', async (_req, reply) => {
    await serveIndex(reply);
  });
}
