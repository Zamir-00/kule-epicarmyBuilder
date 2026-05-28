import { router } from './router.js';
import { authRouter } from './auth.js';

export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
