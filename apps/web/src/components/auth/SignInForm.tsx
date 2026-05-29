import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

export function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requestMagicLink = trpc.auth.requestMagicLink.useMutation();

  const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setSubmitError('Enter a valid email address.');
      return;
    }
    try {
      await requestMagicLink.mutateAsync({ email: trimmed });
      navigate({ to: '/auth-pending', search: { email: trimmed } });
    } catch (err: unknown) {
      // Per stage 2's known concern, the Resend error message can leak the registered email.
      // Show a generic message in the UI; the actual error is in the network tab if needed.
      const message = err instanceof Error ? err.message : undefined;
      setSubmitError(
        message?.includes('Resend')
          ? "We couldn't send the email right now. Try again in a minute."
          : message ?? 'Something went wrong. Try again.'
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>
      {submitError && (
        <p className="text-sm text-destructive" role="alert">{submitError}</p>
      )}
      <Button type="submit" disabled={requestMagicLink.isPending}>
        {requestMagicLink.isPending ? 'Sending…' : 'Send sign-in link'}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">
        We&apos;ll email you a one-time sign-in link that expires in 15 minutes. No password needed.
      </p>
    </form>
  );
}
