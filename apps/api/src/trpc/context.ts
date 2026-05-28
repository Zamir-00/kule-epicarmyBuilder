import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { Db } from '../db/client.js';
import type { EmailTransport } from '../auth/email.js';
import type { User } from '../db/schema.js';
import { loadSession } from '../auth/sessions.js';
import { readSessionCookie } from '../auth/cookie.js';

export interface TrpcDeps {
  db: Db;
  emailTransport: EmailTransport;
  baseUrl: string;
}

export type TrpcContext = {
  req: CreateFastifyContextOptions['req'];
  res: CreateFastifyContextOptions['res'];
  db: Db;
  emailTransport: EmailTransport;
  baseUrl: string;
  user: User | null;
  sessionId: string | null;
};

export function buildContextFactory(deps: TrpcDeps) {
  return ({ req, res }: CreateFastifyContextOptions): TrpcContext => {
    const sessionId = readSessionCookie(req);
    const loaded = sessionId ? loadSession(deps.db, sessionId) : null;
    return {
      req,
      res,
      db: deps.db,
      emailTransport: deps.emailTransport,
      baseUrl: deps.baseUrl,
      user: loaded?.user ?? null,
      sessionId: loaded?.sessionId ?? null,
    };
  };
}
