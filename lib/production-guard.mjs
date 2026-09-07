import { createRequire } from 'node:module';
import { timingSafeEqual } from 'node:crypto';
import { createSessionAuth } from './session-auth.mjs';
import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createRateLimiter } from './rate-limit.mjs';
const http = createRequire(import.meta.url)('node:http');

if (!globalThis.__HAFIZE_PRODUCTION_GUARD__) {
  globalThis.__HAFIZE_PRODUCTION_GUARD__ = true;
  const host = process.env.HOST || '127.0.0.1';
  const required = bool(process.env.HAFIZE_AUTH_REQUIRED, process.env.NODE_ENV === 'production' || host !== '127.0.0.1');
  const secret = (process.env.HAFIZE_AUTH_TOKEN || '').trim();
  const connectorToken = (process.env.HAFIZE_CONNECTOR_AUTH_TOKEN || '').trim();
  const connectorSubject = (process.env.HAFIZE_CONNECTOR_AUTH_SUBJECT || '').trim();
  if (required && secret.length < 32) throw new Error('HAFIZE_AUTH_TOKEN_REQUIRED_FOR_PUBLIC_RUNTIME');
  const auth = secret ? createSessionAuth({ secret, subject: process.env.HAFIZE_AUTH_SUBJECT, ttlSeconds: int(process.env.HAFIZE_AUTH_SESSION_TTL_SECONDS, 7 * 86400, 300, 30 * 86400), secureCookie: bool(process.env.HAFIZE_COOKIE_SECURE, process.env.NODE_ENV === 'production') }) : null;
  const connectorAuth = connectorToken && connectorSubject
    ? createBearerPrincipalAuthenticator({ token: connectorToken, subject: connectorSubject })
    : null;
  const loginLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, maxConcurrent: 1, maxEntries: 5000 });
  const apiLimit = createRateLimiter({ windowMs: 60 * 1000, max: 120, maxConcurrent: 8, maxEntries: 20000 });
  const chatLimit = createRateLimiter({ windowMs: 60 * 1000, max: 20, maxConcurrent: 2, maxEntries: 20000 });
  const original = http.createServer;
  http.createServer = function hafizeCreateServer(...args) {
    const i = args.length - 1, listener = args[i];
    if (typeof listener !== 'function') return original.apply(this, args);
    args[i] = async (req, res) => {
      const path = pathname(req.url);
      if (path === '/api/auth/session' && req.method === 'GET') return session(req, res);
      if (path === '/api/auth/login' && req.method === 'POST') return login(req, res);
      if (path === '/api/auth/logout' && req.method === 'POST') return logout(req, res);
      if (required && protectedPath(path)) {
        const current = authenticateProtected(req, path);
        if (!current.ok) return deny(res);
        if (current.session && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !csrf(req, current)) {
          return send(res, 403, { error: 'CSRF_REQUIRED' });
        }
        const limit = (path === '/api/chat' || path === '/api/agent/run') ? chatLimit : apiLimit;
        const decision = limit.check(`${current.subject}:${path === '/api/chat' || path === '/api/agent/run' ? 'chat' : 'api'}`);
        if (!decision.ok) return rate(res, decision.retryAfterSeconds);
        res.once('close', decision.release); res.once('finish', decision.release);
      } else if (!required && (path === '/api/chat' || path === '/api/agent/run')) {
        const decision = chatLimit.check(`ip:${ip(req)}`); if (!decision.ok) return rate(res, decision.retryAfterSeconds);
        res.once('close', decision.release); res.once('finish', decision.release);
      }
      return listener(req, res);
    };
    return original.apply(this, args);
  };

  function protectedPath(path) { return ['/api/models', '/api/agents', '/api/chat', '/api/agent/run', '/api/connectors/canva/status', '/api/connectors/gmail/status'].includes(path); }
  function connectorPath(path) { return path === '/api/agent/run' || path === '/api/connectors/canva/status' || path === '/api/connectors/gmail/status'; }
  function pathname(value) { try { return new URL(value || '/', 'http://hafize.local').pathname; } catch { return '/'; } }
  function ip(req) { const forwarded = req.headers['x-forwarded-for']; return bool(process.env.HAFIZE_TRUST_PROXY, false) && typeof forwarded === 'string' ? forwarded.split(',')[0].trim().slice(0, 200) : String(req.socket?.remoteAddress || 'unknown').slice(0, 200); }
  function authenticateProtected(req, path) {
    const current = auth?.authenticate(req.headers);
    if (current?.ok) return { ok: true, session: true, subject: current.principal.subject, csrf: current.csrf };
    if (connectorPath(path) && connectorAuth) {
      const connector = connectorAuth.authenticate({ headers: req.headers });
      if (connector?.ok) return { ok: true, session: false, connector: true, subject: `connector:${connector.principal.subject}` };
    }
    return { ok: false };
  }
  function csrf(req, current) { const value = req.headers['x-hafize-csrf']; return typeof value === 'string' && equal(value, current.csrf); }
  function equal(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); if (x.length !== y.length) { const z = Buffer.alloc(y.length); x.copy(z, 0, 0, Math.min(x.length, y.length)); timingSafeEqual(z, y); return false; } return timingSafeEqual(x, y); }
  function bool(value, fallback) { return value == null || value === '' ? fallback : /^(1|true|yes|on)$/i.test(String(value).trim()); }
  function int(value, fallback, min, max) { const n = Number.parseInt(value || '', 10); return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback; }
  function deny(res) { res.setHeader('WWW-Authenticate', 'Bearer realm="Hafize"'); return send(res, 401, { error: 'AUTH_REQUIRED' }); }
  function rate(res, seconds) { res.setHeader('Retry-After', String(seconds)); return send(res, 429, { error: 'RATE_LIMITED', retryAfterSeconds: seconds }); }
  function send(res, status, body) { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer'); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
  async function json(req, max = 8192) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > max) throw new Error('BODY_TOO_LARGE'); chunks.push(chunk); } const text = Buffer.concat(chunks).toString('utf8'); return text ? JSON.parse(text) : {}; }
  function session(req, res) { if (!required) return send(res, 200, { required: false, authenticated: true, csrf: '' }); const current = auth.authenticate(req.headers); return send(res, 200, { required: true, authenticated: current.ok, csrf: current.ok ? current.csrf : '' }); }
  async function login(req, res) { if (!auth) return send(res, 503, { error: 'AUTH_NOT_CONFIGURED' }); const decision = loginLimit.check(`login:${ip(req)}`); if (!decision.ok) return rate(res, decision.retryAfterSeconds); res.once('close', decision.release); res.once('finish', decision.release); try { const body = await json(req); const candidate = typeof body.token === 'string' ? body.token : (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); if (!auth.verifyCredential(candidate)) return deny(res); const value = auth.issueSession(), current = auth.verifySessionCookie(value); res.setHeader('Set-Cookie', auth.sessionCookieHeader(value)); return send(res, 200, { authenticated: true, csrf: current.csrf }); } catch (error) { return send(res, error?.message === 'BODY_TOO_LARGE' ? 413 : 400, { error: error?.message === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'INVALID_JSON' }); } }
  function logout(req, res) { const current = auth?.authenticate(req.headers); if (required && !current?.ok) return deny(res); if (current?.ok && !csrf(req, current)) return send(res, 403, { error: 'CSRF_REQUIRED' }); res.setHeader('Set-Cookie', auth?.clearCookieHeader() || ''); return send(res, 200, { ok: true }); }
}
