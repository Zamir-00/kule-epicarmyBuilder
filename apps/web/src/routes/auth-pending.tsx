import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  email: z.string().email().optional(),
});

export const Route = createFileRoute('/auth-pending')({
  component: AuthPendingPage,
  validateSearch: searchSchema,
});

function AuthPendingPage() {
  const { email } = Route.useSearch();
  return (
    <main className="container mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">Check your email</h1>
      <p className="text-muted-foreground">
        {email ? (
          <>We sent a sign-in link to <strong className="text-foreground">{email}</strong>.</>
        ) : (
          'We sent you a sign-in link.'
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        The link expires in 15 minutes. Click it from the same browser where you&apos;ll continue.
      </p>
      <p className="text-sm">
        <Link to="/sign-in" className="underline underline-offset-4">Wrong email? Try again →</Link>
      </p>
    </main>
  );
}
