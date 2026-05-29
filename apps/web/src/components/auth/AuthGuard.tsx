import { type ReactNode, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoading, isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      navigate({
        to: '/sign-in',
        replace: true,
      });
    }
  }, [isLoading, isSignedIn, navigate]);

  if (isLoading) {
    return <main className="container mx-auto p-8 text-muted-foreground">Loading…</main>;
  }
  if (!isSignedIn) return null; // about to redirect

  return <>{children}</>;
}
