import { router } from './router.js';
import { authRouter } from './auth.js';
import { listsRouter } from './lists.js';

export const appRouter = router({
  auth: authRouter,
  lists: listsRouter,
});

export type AppRouter = typeof appRouter;
