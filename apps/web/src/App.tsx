import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { trpc, trpcClient } from '@/lib/trpc';
import { routeTree } from './routeTree.gen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// basepath mirrors the Vite `base` setting (vite.config.ts). The router needs
// this so it strips `/v2` from window.location.pathname before matching routes.
// Without it, URLs like `/v2?preview=1` (no trailing slash) fall through to
// TanStack Router's default "Not Found" page.
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {},
  basepath: '/v2',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
