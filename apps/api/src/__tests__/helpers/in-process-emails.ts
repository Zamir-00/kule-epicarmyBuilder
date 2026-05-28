import type { EmailTransport, SendEmailInput } from '../../auth/email.js';

export interface InProcessEmails extends EmailTransport {
  all(): SendEmailInput[];
  last(): SendEmailInput;
  clear(): void;
  count(): number;
}

export function createInProcessEmails(): InProcessEmails {
  const sent: SendEmailInput[] = [];
  return {
    async send(input) { sent.push(input); },
    all() { return [...sent]; },
    last() {
      if (sent.length === 0) throw new Error('no emails sent');
      return sent[sent.length - 1]!;
    },
    count() { return sent.length; },
    clear() { sent.length = 0; },
  };
}
