import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const MIN_SECRET = 32, DEFAULT_TTL = 7 * 86400, MAX_TTL = 30 * 86400;
const cleanSecret = (value) => {
  const secret = typeof value === 'string' ? value.trim() : '';
  if (secret.length < MIN_SECRET || secret.length > 4096 || /\s/.test(secret)) throw new Error('INVALID_SESSION_SECRET');
  return secret;
};
const cleanSubject = (value) => {
  const subject = typeof value === 'string' ? value.trim() : '';
  return subject && subject.length <= 200 ? subject : 'primary-user';
};
const ttlValue = (value) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 300), MAX_TTL) : DEFAULT_TTL;
};
const equal = (left, right) => {
  const a = Buffer.from(String(left)), b = Buffer.from(String(right));
  if (a.length !== b.length) { const padded = Buffer.alloc(b.length); a.copy(padded, 0, 0, Math.min(a.length, b.length)); timingSafeEqual(padded, b); return false; }
  return timingSafeEqual(a, b);
};
const sign = (secret, payload) => createHmac('sha256', secret).update(payload).digest('base64url');
const decodeCookies = (header) => {
  const out = Object.create(null); if (typeof header !== 'string') return out;
  for (const part of header.split(';')) { const i = part.indexOf('='); if (i <= 0) continue; const name = part.slice(0, i).trim(); try { out[name] = decodeURIComponent(part.slice(i + 1).trim()); } catch {} }
  return out;
};

export function createSessionAuth({ secret, subject, ttlSeconds, secureCookie = false, cookieName = 'hafize_session' } = {}) {
  const expected = cleanSecret(secret), owner = cleanSubject(subject), ttl = ttlValue(ttlSeconds);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName)) throw new Error('INVALID_SESSION_COOKIE_NAME');
  const verifyCredential = (candidate) => typeof candidate === 'string' && candidate.trim() !== '' && equal(candidate.trim(), expected);
  const issueSession = () => {
    const data = { sub: owner, exp: Math.floor(Date.now() / 1000) + ttl, csrf: randomBytes(24).toString('base64url') };
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url'); return `${payload}.${sign(expected, payload)}`;
  };
  const verifySessionCookie = (value) => {
    if (typeof value !== 'string') return { ok: false, error: 'AUTH_REQUIRED' };
    const i = value.lastIndexOf('.'); if (i <= 0 || i === value.length - 1) return { ok: false, error: 'AUTH_REQUIRED' };
    const payload = value.slice(0, i); if (!equal(value.slice(i + 1), sign(expected, payload))) return { ok: false, error: 'AUTH_REQUIRED' };
    let data; try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { ok: false, error: 'AUTH_REQUIRED' }; }
    if (!data || data.sub !== owner || typeof data.csrf !== 'string') return { ok: false, error: 'AUTH_REQUIRED' };
    if (!Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return { ok: false, error: 'AUTH_EXPIRED' };
    return { ok: true, principal: Object.freeze({ authenticated: true, subject: data.sub }), csrf: data.csrf, expiresAt: data.exp };
  };
  const authenticate = (headers) => verifySessionCookie(decodeCookies(headers?.cookie ?? headers?.Cookie)[cookieName]);
  const suffix = secureCookie ? '; Secure' : '';
  const sessionCookieHeader = (value) => `${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${suffix}`;
  const clearCookieHeader = () => `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${suffix}`;
  return Object.freeze({ cookieName, ttlSeconds: ttl, verifyCredential, issueSession, authenticate, verifySessionCookie, sessionCookieHeader, clearCookieHeader });
}
