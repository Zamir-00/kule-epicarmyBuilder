import { createCallerFactory } from '../../trpc/router.js';
import { appRouter } from '../../trpc/index.js';
import type { TrpcContext } from '../../trpc/context.js';
import { createTestDb, type TestDbHandle } from './test-db.js';
import { createInProcessEmails, type InProcessEmails } from './in-process-emails.js';
import { loadSession } from '../../auth/sessions.js';

export interface TestApp {
  trpc: TestTrpcClient;
  emails: InProcessEmails;
  dbHandle: TestDbHandle;
  close(): void;
}

export interface TestTrpcClient {
  auth: AuthCalls;
  withSession(sessionId: string): TestTrpcClient;
}

interface AuthCalls {
  requestMagicLink: { mutate(input: { email: string }): Promise<{ ok: true }> };
  verifyMagicLink: { mutate(input: { token: string }): Promise<{ sessionId: string; userId: string }> };
  signOut: { mutate(): Promise<{ ok: true }> };
  me: { query(): Promise<unknown> };
}

// In tRPC v11, createCallerFactory(router) returns (ctx) => caller
// The caller has procedures as direct async functions: caller.auth.requestMagicLink(input)
const makeCallerForRouter = createCallerFactory(appRouter);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function buildClient(ctx: TrpcContext): TestTrpcClient {
  const caller = makeCallerForRouter(ctx);
  const auth = caller.auth as unknown as Record<string, AnyFn>;

  return {
    auth: {
      requestMagicLink: {
        mutate: (input: { email: string }) => auth['requestMagicLink']!(input) as Promise<{ ok: true }>,
      },
      verifyMagicLink: {
        mutate: (input: { token: string }) => auth['verifyMagicLink']!(input) as Promise<{ sessionId: string; userId: string }>,
      },
      signOut: {
        mutate: () => auth['signOut']!() as Promise<{ ok: true }>,
      },
      me: {
        query: () => auth['me']!() as Promise<unknown>,
      },
    },
    withSession(sessionId: string): TestTrpcClient {
      const loaded = loadSession(ctx.db, sessionId);
      return buildClient({ ...ctx, user: loaded?.user ?? null, sessionId: loaded?.sessionId ?? null });
    },
  };
}

export function buildTestApp(): TestApp {
  const dbHandle = createTestDb();
  const emails = createInProcessEmails();
  const baseCtx: TrpcContext = {
    req: { headers: {} } as unknown as TrpcContext['req'],
    res: {} as unknown as TrpcContext['res'],
    db: dbHandle.db,
    emailTransport: emails,
    baseUrl: 'http://test',
    user: null,
    sessionId: null,
  };
  const trpc = buildClient(baseCtx);
  return {
    trpc,
    emails,
    dbHandle,
    close: () => dbHandle.close(),
  };
}
