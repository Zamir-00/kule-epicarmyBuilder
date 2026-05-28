import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailTransport {
  send(input: SendEmailInput): Promise<void>;
}

/** Dev fallback: logs the email to stdout instead of sending. */
export function createConsoleTransport(): EmailTransport {
  return {
    async send(input) {
      console.log('[email-stub]', JSON.stringify(input, null, 2));
    },
  };
}

/** Production transport: sends via Resend. */
export function createResendTransport(apiKey: string, from: string): EmailTransport {
  const client = new Resend(apiKey);
  return {
    async send({ to, subject, html, text }) {
      const result = await client.emails.send({ from, to, subject, html, text });
      if (result.error) {
        throw new Error(`Resend send failed: ${result.error.message ?? JSON.stringify(result.error)}`);
      }
    },
  };
}
