import { timingSafeEqual } from 'node:crypto';
import type { HeaderMap } from './session-auth.ts';

const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 4096;

export interface Principal {
  readonly authenticated: true;
  readonly subject: string;
}

export type BearerAuthResult =
  | { readonly ok: true; readonly principal: Principal }
  | { readonly ok: false; readonly error: 'AUTH_REQUIRED' };

export interface BearerAuthenticatorOptions {
  readonly token?: unknown;
  readonly subject?: unknown;
}

export interface BearerPrincipalAuthenticator {
  readonly authenticate: (input?: { readonly headers?: HeaderMap }) => BearerAuthResult;
}

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

function readAuthorization(headers?: HeaderMap): string {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers.authorization ?? headers.Authorization;
  return Array.isArray(value) ? String(value[0] || '').trim() : typeof value === 'string' ? value.trim() : '';
}

function constantTimeTokenEquals(candidate: string, expected: string): boolean {
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

export function createBearerPrincipalAuthenticator(options: BearerAuthenticatorOptions = {}): BearerPrincipalAuthenticator {
  const expectedToken = cleanToken(options.token);
  const principalSubject = cleanSubject(options.subject);

  const authenticate = ({ headers }: { readonly headers?: HeaderMap } = {}): BearerAuthResult => {
    const authorization = readAuthorization(headers);
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) return { ok: false, error: 'AUTH_REQUIRED' };

    try {
      if (!constantTimeTokenEquals(match[1], expectedToken)) return { ok: false, error: 'AUTH_REQUIRED' };
    } catch {
      return { ok: false, error: 'AUTH_REQUIRED' };
    }

    return { ok: true, principal: Object.freeze({ authenticated: true as const, subject: principalSubject }) };
  };

  return Object.freeze({ authenticate });
}
