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
