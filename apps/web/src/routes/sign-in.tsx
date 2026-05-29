import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { SignInForm } from '@/components/auth/SignInForm';

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
});

function SignInPage() {
  const { isLoading, isSignedIn } = useAuth();
  const navigate = useNavigate();

  // Already signed in → bounce to home
  useEffect(() => {
    if (!isLoading && isSignedIn) {
      navigate({ to: '/', replace: true });
    }
  }, [isLoading, isSignedIn, navigate]);

  if (isLoading) {
    return <main className="container mx-auto p-8 text-muted-foreground">Loading…</main>;
  }
  if (isSignedIn) return null; // about to redirect

  return (
    <main className="container mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-muted-foreground">
        Enter your email and we&apos;ll send you a sign-in link.
      </p>
      <SignInForm />
    </main>
  );
}
