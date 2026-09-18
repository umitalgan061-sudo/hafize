import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthenticationResult } from './runtime-contracts.ts';

const MIN_SECRET = 32;
const MAX_SECRET = 4096;
const DEFAULT_TTL = 7 * 86400;
const MAX_TTL = 30 * 86400;

interface SessionHeaders {
  readonly cookie?: string | string[];
  readonly Cookie?: string;
}

interface SessionOptions {
  readonly secret: unknown;
  readonly subject?: unknown;
  readonly ttlSeconds?: unknown;
  readonly secureCookie?: boolean;
  readonly cookieName?: string;
}

interface SessionSuccess {
  readonly ok: true;
  readonly principal: { readonly authenticated: true; readonly subject: string };
  readonly csrf: string;
  readonly expiresAt: number;
}

interface SessionFailure { readonly ok: false; readonly error: 'AUTH_REQUIRED' | 'AUTH_EXPIRED'; }

function secretValue(value: unknown): string {
  const secret = typeof value === 'string' ? value.trim() : '';
  if (secret.length < MIN_SECRET || secret.length > MAX_SECRET || /\s/.test(secret)) throw new Error('INVALID_SESSION_SECRET');
  return secret;
}
function subjectValue(value: unknown): string {
  const subject = typeof value === 'string' ? value.trim() : '';
  return subject && subject.length <= 200 ? subject : 'primary-user';
}
function ttlValue(value: unknown): number {
  const parsed = Number.parseInt(value == null ? '' : String(value), 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 300), MAX_TTL) : DEFAULT_TTL;
}
function equal(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    const padded = Buffer.alloc(b.length);
    a.copy(padded, 0, 0, Math.min(a.length, b.length));
    timingSafeEqual(padded, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
function cookieHeaderValue(headers: SessionHeaders | undefined): string {
  const raw = headers?.cookie ?? headers?.Cookie;
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw : '';
}
function decodeCookies(header: string): Record<string, string> {
  const output: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    try { output[name] = decodeURIComponent(part.slice(index + 1).trim()); } catch {}
  }
  return output;
}

export function createSessionAuth({
  secret,
  subject,
  ttlSeconds,
  secureCookie = false,
  cookieName = 'hafize_session'
}: SessionOptions): Readonly<{
  cookieName: string;
  ttlSeconds: number;
  verifyCredential: (candidate: unknown) => boolean;
  issueSession: () => string;
  authenticate: (headers?: SessionHeaders) => AuthenticationResult & { readonly csrf?: string; readonly expiresAt?: number };
  verifySessionCookie: (value: unknown) => SessionSuccess | SessionFailure;
  sessionCookieHeader: (value: string) => string;
  clearCookieHeader: () => string;
}> {
  const expected = secretValue(secret);
  const owner = subjectValue(subject);
  const ttl = ttlValue(ttlSeconds);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName || '')) throw new Error('INVALID_SESSION_COOKIE_NAME');

  function verifyCredential(candidate: unknown): boolean {
    return typeof candidate === 'string' && candidate.trim() !== '' && equal(candidate.trim(), expected);
  }
  function issueSession(): string {
    const data = { sub: owner, exp: Math.floor(Date.now() / 1000) + ttl, csrf: randomBytes(24).toString('base64url') };
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    return payload + '.' + sign(expected, payload);
  }
  function verifySessionCookie(value: unknown): SessionSuccess | SessionFailure {
    if (typeof value !== 'string') return { ok: false, error: 'AUTH_REQUIRED' };
    const index = value.lastIndexOf('.');
    if (index <= 0 || index === value.length - 1) return { ok: false, error: 'AUTH_REQUIRED' };
    const payload = value.slice(0, index);
    if (!equal(value.slice(index + 1), sign(expected, payload))) return { ok: false, error: 'AUTH_REQUIRED' };
    let data: unknown;
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { ok: false, error: 'AUTH_REQUIRED' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'AUTH_REQUIRED' };
    const source = data as Record<string, unknown>;
    if (source.sub !== owner || typeof source.csrf !== 'string') return { ok: false, error: 'AUTH_REQUIRED' };
    if (!Number.isInteger(source.exp) || Number(source.exp) <= Math.floor(Date.now() / 1000)) return { ok: false, error: 'AUTH_EXPIRED' };
    return Object.freeze({
      ok: true,
      principal: Object.freeze({ authenticated: true as const, subject: owner }),
      csrf: source.csrf,
      expiresAt: Number(source.exp)
    });
  }
  function authenticate(headers?: SessionHeaders) {
    return verifySessionCookie(decodeCookies(cookieHeaderValue(headers))[cookieName]);
  }
  const secure = secureCookie ? '; Secure' : '';
  return Object.freeze({
    cookieName,
    ttlSeconds: ttl,
    verifyCredential,
    issueSession,
    authenticate,
    verifySessionCookie,
    sessionCookieHeader: (value: string) => cookieName + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + ttl + secure,
    clearCookieHeader: () => cookieName + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + secure
  });
}
