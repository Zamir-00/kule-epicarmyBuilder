import { Outlet, createRootRoute, Link } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

function Header() {
  const { isLoading, isSignedIn, user } = useAuth();
  const signOut = trpc.auth.signOut.useMutation({
    onSuccess: () => window.location.assign('/v2'),
  });
  return (
    <header className="border-b print:hidden">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="text-lg font-semibold">Kule Army Builder</Link>
        <nav className="flex items-center gap-3">
          {isLoading ? (
            <span className="text-sm text-muted-foreground">…</span>
          ) : isSignedIn ? (
            <>
              <Link to="/lists">
                <Button variant="ghost" size="sm">My lists</Button>
              </Link>
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={() => signOut.mutate()}>
                Sign out
              </Button>
            </>
          ) : (
            <Link to="/sign-in">
              <Button variant="outline" size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export const Route = createRootRoute({
  component: () => (
    <>
      <Header />
      <Outlet />
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <TanStackRouterDevtools />
        </Suspense>
      )}
    </>
  ),
});
