export interface MagicLinkEmail {
  subject: string;
  text: string;
  html: string;
}

export function magicLinkEmail({ baseUrl, token }: { baseUrl: string; token: string }): MagicLinkEmail {
  const url = `${baseUrl}/sign-in?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Sign in to Kule Army Builder',
    text:
      "Click this link to sign in to Kule Army Builder. It expires in 15 minutes.\n\n" +
      url +
      "\n\nIf you didn't request this, ignore this email.",
    html:
      "<p>Click <a href=\"" + escapeHtml(url) + "\">this link</a> to sign in to Kule Army Builder. " +
      "It expires in 15 minutes.</p>" +
      "<p>If you didn't request this, ignore this email.</p>",
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!));
}
