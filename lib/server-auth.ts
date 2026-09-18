import { timingSafeEqual } from 'node:crypto';
import type { AuthenticationResult } from './runtime-contracts.ts';

export interface AuthHeaders {
  readonly authorization?: string | string[];
  readonly Authorization?: string;
  readonly [key: string]: unknown;
}

export interface BearerAuthOptions {
  readonly token?: unknown;
  readonly subject?: unknown;
}

const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 4096;

function cleanSubject(value: unknown): string {
  const subject = typeof value === 'string' ? value.trim() : '';
  if (!subject || subject.length > 200) throw new Error('INVALID_SERVER_AUTH:subject');
  return subject;
}

function cleanToken(value: unknown): string {
  const token = typeof value === 'string' ? value.trim() : '';
  if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) {
    throw new Error('INVALID_SERVER_AUTH:token');
  }
  return token;
}

function readAuthorization(headers: AuthHeaders | undefined): string {
  if (!headers || typeof headers !== 'object') return '';
  const raw = headers.authorization ?? headers.Authorization;
  if (Array.isArray(raw)) return raw[0]?.trim() || '';
  return typeof raw === 'string' ? raw.trim() : '';
}

function constantTimeEquals(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  if (left.length !== right.length) {
    const padded = Buffer.alloc(right.length);
    left.copy(padded, 0, 0, Math.min(left.length, right.length));
    timingSafeEqual(padded, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function createBearerPrincipalAuthenticator(
  { token, subject }: BearerAuthOptions = {}
): Readonly<{
  authenticate(input?: { readonly headers?: AuthHeaders }): AuthenticationResult;
}> {
  const expectedToken = cleanToken(token);
  const principalSubject = cleanSubject(subject);

  function authenticate({ headers }: { readonly headers?: AuthHeaders } = {}): AuthenticationResult {
    const match = /^Bearer ([^\s]+)$/i.exec(readAuthorization(headers));
    if (!match) return { ok: false, error: 'AUTH_REQUIRED' };
    try {
      if (!constantTimeEquals(match[1] || '', expectedToken)) return { ok: false, error: 'AUTH_REQUIRED' };
    } catch {
      return { ok: false, error: 'AUTH_REQUIRED' };
    }
    return Object.freeze({
      ok: true,
      principal: Object.freeze({ authenticated: true as const, subject: principalSubject })
    });
  }

  return Object.freeze({ authenticate });
}

export const SERVER_AUTH_LIMITS = Object.freeze({
  minTokenLength: MIN_TOKEN_LENGTH,
  maxTokenLength: MAX_TOKEN_LENGTH,
  maxSubjectLength: 200
});
