import type { FastifyReply, FastifyRequest } from 'fastify';

const COOKIE_NAME = 'session';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function setSessionCookie(reply: FastifyReply, sessionId: string, isProd: boolean): void {
  const parts = [
    `${COOKIE_NAME}=${sessionId}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (isProd) parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(reply: FastifyReply, isProd: boolean): void {
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
}

export function readSessionCookie(req: FastifyRequest): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === COOKIE_NAME && v) return v;
  }
  return null;
}
