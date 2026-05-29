import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/sign-in')({
  component: SignInStub,
});

function SignInStub() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">
        Sign-in form lands in S3.4. This is a placeholder.
      </p>
    </main>
  );
}
