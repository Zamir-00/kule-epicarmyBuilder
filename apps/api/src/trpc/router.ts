import { initTRPC, TRPCError } from '@trpc/server';
import type { TrpcContext } from './context.js';

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const procedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'sign in required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });  // narrow user from User|null to User
});
