import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type HeaderValue = string | string[] | undefined;
export type HeaderMap = Record<string, HeaderValue>;

const MIN_SECRET = 32;
const DEFAULT_TTL = 7 * 86400;
const MAX_TTL = 30 * 86400;

export interface SessionPrincipal {
  readonly authenticated: true;
  readonly subject: string;
}

export type SessionVerification =
  | { readonly ok: true; readonly principal: SessionPrincipal; readonly csrf: string; readonly expiresAt: number }
  | { readonly ok: false; readonly error: 'AUTH_REQUIRED' | 'AUTH_EXPIRED' };

export interface SessionAuthOptions {
  readonly secret?: unknown;
  readonly subject?: unknown;
  readonly ttlSeconds?: unknown;
  readonly secureCookie?: boolean;
  readonly cookieName?: string;
}

export interface SessionAuth {
  readonly cookieName: string;
  readonly ttlSeconds: number;
  readonly verifyCredential: (candidate: unknown) => boolean;
  readonly issueSession: () => string;
  readonly authenticate: (headers?: HeaderMap) => SessionVerification;
  readonly verifySessionCookie: (value: unknown) => SessionVerification;
  readonly sessionCookieHeader: (value: string) => string;
  readonly clearCookieHeader: () => string;
}

const cleanSecret = (value: unknown): string => {
  const secret = typeof value === 'string' ? value.trim() : '';
  if (secret.length < MIN_SECRET || secret.length > 4096 || /\s/.test(secret)) throw new Error('INVALID_SESSION_SECRET');
  return secret;
};

const cleanSubject = (value: unknown): string => {
  const subject = typeof value === 'string' ? value.trim() : '';
  return subject && subject.length <= 200 ? subject : 'primary-user';
};

const ttlValue = (value: unknown): number => {
  const parsed = Number.parseInt(typeof value === 'number' || typeof value === 'string' ? String(value) : '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 300), MAX_TTL) : DEFAULT_TTL;
};

const equal = (left: unknown, right: unknown): boolean => {
  const a = Buffer.from(String(left ?? ''));
  const b = Buffer.from(String(right ?? ''));
  if (a.length !== b.length) {
    const padded = Buffer.alloc(b.length);
    a.copy(padded, 0, 0, Math.min(a.length, b.length));
    timingSafeEqual(padded, b);
    return false;
  }
  return timingSafeEqual(a, b);
};

const sign = (secret: string, payload: string): string => createHmac('sha256', secret).update(payload).digest('base64url');

const decodeCookies = (header: HeaderValue): Record<string, string> => {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return out;
  for (const part of value.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    try { out[name] = decodeURIComponent(part.slice(index + 1).trim()); } catch {}
  }
  return out;
};

export function createSessionAuth(options: SessionAuthOptions = {}): SessionAuth {
  const expected = cleanSecret(options.secret);
  const owner = cleanSubject(options.subject);
  const ttl = ttlValue(options.ttlSeconds);
  const cookieName = typeof options.cookieName === 'string' ? options.cookieName : 'hafize_session';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName)) throw new Error('INVALID_SESSION_COOKIE_NAME');

  const verifyCredential = (candidate: unknown): boolean => typeof candidate === 'string' && candidate.trim() !== '' && equal(candidate.trim(), expected);
  const issueSession = (): string => {
    const data = { sub: owner, exp: Math.floor(Date.now() / 1000) + ttl, csrf: randomBytes(24).toString('base64url') };
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    return `${payload}.${sign(expected, payload)}`;
  };

  const verifySessionCookie = (value: unknown): SessionVerification => {
    if (typeof value !== 'string') return { ok: false, error: 'AUTH_REQUIRED' };
    const index = value.lastIndexOf('.');
    if (index <= 0 || index === value.length - 1) return { ok: false, error: 'AUTH_REQUIRED' };
    const payload = value.slice(0, index);
    if (!equal(value.slice(index + 1), sign(expected, payload))) return { ok: false, error: 'AUTH_REQUIRED' };
    let data: unknown;
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { ok: false, error: 'AUTH_REQUIRED' }; }
    if (!data || typeof data !== 'object') return { ok: false, error: 'AUTH_REQUIRED' };
    const candidate = data as Record<string, unknown>;
    if (candidate.sub !== owner || typeof candidate.csrf !== 'string') return { ok: false, error: 'AUTH_REQUIRED' };
    if (!Number.isInteger(candidate.exp) || Number(candidate.exp) <= Math.floor(Date.now() / 1000)) return { ok: false, error: 'AUTH_EXPIRED' };
    return {
      ok: true,
      principal: Object.freeze({ authenticated: true as const, subject: String(candidate.sub) }),
      csrf: candidate.csrf,
      expiresAt: Number(candidate.exp)
    };
  };

  const authenticate = (headers: HeaderMap = {}): SessionVerification => {
    const cookies = decodeCookies(headers.cookie ?? headers.Cookie);
    return verifySessionCookie(cookies[cookieName]);
  };

  const suffix = options.secureCookie ? '; Secure' : '';
  const sessionCookieHeader = (value: string): string => `${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${suffix}`;
  const clearCookieHeader = (): string => `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${suffix}`;

  return Object.freeze({ cookieName, ttlSeconds: ttl, verifyCredential, issueSession, authenticate, verifySessionCookie, sessionCookieHeader, clearCookieHeader });
}
