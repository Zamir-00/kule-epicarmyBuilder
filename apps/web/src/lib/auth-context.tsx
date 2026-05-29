import { trpc } from './trpc';

export function useAuth() {
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return {
    isLoading: me.isLoading,
    isSignedIn: !!me.data && !me.error,
    user: (me.data as { id: string; email: string; display_name: string | null } | null | undefined) ?? null,
  };
}
