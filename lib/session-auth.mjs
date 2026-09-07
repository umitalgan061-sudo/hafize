import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const MIN_SECRET_LENGTH = 32;
const MAX_SECRET_LENGTH = 4096;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;

function cleanSecret(value) {
  const secret = typeof value === 'string' ? value.trim() : '';
  if (secret.length < MIN_SECRET_LENGTH || secret.length > MAX_SECRET_LENGTH || /\s/.test(secret)) {
    throw new Error('INVALID_SESSION_SECRET');
  }
  return secret;
}

function cleanSubject(value) {
  const subject = typeof value === 'string' ? value.trim() : '';
  return subject && subject.length <= 200 ? subject : 'primary-user';
}

function boundedTtl(value) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isInteger(parsed)) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(parsed, 300), MAX_TTL_SECONDS);
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEquals(left, right) {
  const a = Buffer.from(String(left), 'utf8');
  const b = Buffer.from(String(right), 'utf8');
  if (a.length !== b.length) {
    const padded = Buffer.alloc(b.length);
    a.copy(padded, 0, 0, Math.min(a.length, b.length));
    timingSafeEqual(padded, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function parseCookies(header) {
  const cookies = Object.create(null);
  if (typeof header !== 'string') return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function createSignedSession(secret, subject, ttlSeconds) {
  const payloadObject = {
    sub: subject,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    csrf: randomBytes(24).toString('base64url')
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObject));
  return `${payload}.${sign(secret, payload)}`;
}

export function createSessionAuth({
  secret,
  subject,
  ttlSeconds,
  secureCookie = false,
  cookieName = 'hafize_session'
} = {}) {
  const expectedSecret = cleanSecret(secret);
  const sessionSubject = cleanSubject(subject);
  const ttl = boundedTtl(ttlSeconds);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName)) throw new Error('INVALID_SESSION_COOKIE_NAME');

  function verifyCredential(candidate) {
    if (typeof candidate !== 'string' || !candidate.trim()) return false;
    return safeEquals(candidate.trim(), expectedSecret);
  }

  function issueSession() {
    return createSignedSession(expectedSecret, sessionSubject, ttl);
  }

  function verifySessionCookie(cookieValue) {
    if (typeof cookieValue !== 'string') return { ok: false, error: 'AUTH_REQUIRED' };
    const separator = cookieValue.lastIndexOf('.');
    if (separator <= 0 || separator === cookieValue.length - 1) return { ok: false, error: 'AUTH_REQUIRED' };
    const payload = cookieValue.slice(0, separator);
    const signature = cookieValue.slice(separator + 1);
    if (!safeEquals(signature, sign(expectedSecret, payload))) return { ok: false, error: 'AUTH_REQUIRED' };

    let data;
    try {
      data = JSON.parse(base64UrlDecode(payload));
    } catch {
      return { ok: false, error: 'AUTH_REQUIRED' };
    }
    if (!data || typeof data !== 'object' || data.sub !== sessionSubject || typeof data.csrf !== 'string') {
      return { ok: false, error: 'AUTH_REQUIRED' };
    }
    if (!Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) {
      return { ok: false, error: 'AUTH_EXPIRED' };
    }
    return {
      ok: true,
      principal: Object.freeze({ authenticated: true, subject: data.sub }),
      csrf: data.csrf,
      expiresAt: data.exp
    };
  }

  function authenticate(headers) {
    const cookies = parseCookies(headers?.cookie ?? headers?.Cookie);
    return verifySessionCookie(cookies[cookieName]);
  }

  function sessionCookieHeader(sessionValue) {
    const secure = secureCookie ? '; Secure' : '';
    return `${cookieName}=${encodeURIComponent(sessionValue)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secure}`;
  }

  function clearCookieHeader() {
    const secure = secureCookie ? '; Secure' : '';
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  }

  return Object.freeze({
    cookieName,
    ttlSeconds: ttl,
    verifyCredential,
    issueSession,
    authenticate,
    verifySessionCookie,
    sessionCookieHeader,
    clearCookieHeader
  });
}
