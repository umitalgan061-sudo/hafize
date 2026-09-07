import { createRequire } from 'node:module';
import { timingSafeEqual } from 'node:crypto';
import { createSessionAuth } from './session-auth.mjs';
import { createRateLimiter } from './rate-limit.mjs';

const require = createRequire(import.meta.url);
const http = require('node:http');

if (!globalThis.__HAFIZE_PRODUCTION_GUARD__) {
  globalThis.__HAFIZE_PRODUCTION_GUARD__ = true;

  const HOST = process.env.HOST || '127.0.0.1';
  const authRequired = parseBoolean(process.env.HAFIZE_AUTH_REQUIRED, process.env.NODE_ENV === 'production' || HOST !== '127.0.0.1');
  const authSecret = (process.env.HAFIZE_AUTH_TOKEN || '').trim();
  const authSubject = process.env.HAFIZE_AUTH_SUBJECT || 'primary-user';
  const secureCookie = parseBoolean(process.env.HAFIZE_COOKIE_SECURE, process.env.NODE_ENV === 'production');
  const sessionTtlSeconds = boundedInteger(process.env.HAFIZE_AUTH_SESSION_TTL_SECONDS, 7 * 24 * 60 * 60, 300, 30 * 24 * 60 * 60);

  if (authRequired && authSecret.length < 32) {
    throw new Error('HAFIZE_AUTH_TOKEN_REQUIRED_FOR_PUBLIC_RUNTIME');
  }

  const sessionAuth = authSecret
    ? createSessionAuth({ secret: authSecret, subject: authSubject, ttlSeconds: sessionTtlSeconds, secureCookie })
    : null;

  const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, maxConcurrent: 1, maxEntries: 5_000 });
  const apiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120, maxConcurrent: 8, maxEntries: 20_000 });
  const chatLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, maxConcurrent: 2, maxEntries: 20_000 });

  const originalCreateServer = http.createServer;
  http.createServer = function hafizeProtectedCreateServer(...args) {
    const listenerIndex = args.length - 1;
    const listener = args[listenerIndex];
    if (typeof listener !== 'function') return originalCreateServer.apply(this, args);

    args[listenerIndex] = async function hafizeProtectedRequest(req, res) {
      const pathname = getPathname(req.url);

      if (pathname === '/api/auth/session' && req.method === 'GET') {
        return handleSession(res);
      }
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        return handleLogin(req, res);
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const session = sessionAuth ? sessionAuth.authenticate(req.headers) : { ok: true, csrf: '' };
        if (authRequired && !session.ok) return rejectAuth(res);
        if (session.ok && !checkCsrf(req, session)) return rejectCsrf(res);
        res.setHeader('Set-Cookie', sessionAuth?.clearCookieHeader() || '');
        return sendJson(res, 200, { ok: true });
      }

      if (authRequired && isProtectedApi(pathname)) {
        const session = sessionAuth.authenticate(req.headers);
        if (!session.ok) return rejectAuth(res);
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && !checkCsrf(req, session)) {
          return rejectCsrf(res);
        }

        const key = `${session.principal.subject}:${pathname === '/api/chat' || pathname === '/api/agent/run' ? 'chat' : 'api'}`;
        const limiter = pathname === '/api/chat' || pathname === '/api/agent/run' ? chatLimiter : apiLimiter;
        const decision = limiter.check(key);
        if (!decision.ok) return rejectRateLimit(res, decision.retryAfterSeconds);
        res.once('close', () => decision.release());
        res.once('finish', () => decision.release());
      } else if (pathname === '/api/auth/login' && req.method === 'POST') {
        // Handled above.
      }

      if (pathname === '/api/chat' || pathname === '/api/agent/run') {
        if (!authRequired) {
          const decision = chatLimiter.check(`ip:${requestIp(req)}`);
          if (!decision.ok) return rejectRateLimit(res, decision.retryAfterSeconds);
          res.once('close', () => decision.release());
          res.once('finish', () => decision.release());
        }
      }

      return listener(req, res);
    };

    return originalCreateServer.apply(this, args);
  };

  function handleSession(res) {
    setSecurityHeaders(res);
    if (!authRequired) return sendJson(res, 200, { required: false, authenticated: true, csrf: '' });
    const session = sessionAuth.authenticate(arguments[0]?.headers || {});
    return sendJson(res, 200, {
      required: true,
      authenticated: session.ok,
      csrf: session.ok ? session.csrf : ''
    });
  }

  async function handleLogin(req, res) {
    if (!sessionAuth) return sendJson(res, 503, { error: 'AUTH_NOT_CONFIGURED' });
    const decision = loginLimiter.check(`login:${requestIp(req)}`);
    if (!decision.ok) return rejectRateLimit(res, decision.retryAfterSeconds);
    res.once('close', () => decision.release());
    res.once('finish', () => decision.release());

    try {
      const body = await readJson(req, 8 * 1024);
      const candidate = typeof body?.token === 'string' ? body.token : readBearer(req.headers);
      if (!sessionAuth.verifyCredential(candidate)) {
        return rejectAuth(res);
      }
      const sessionValue = sessionAuth.issueSession();
      res.setHeader('Set-Cookie', sessionAuth.sessionCookieHeader(sessionValue));
      const session = sessionAuth.verifySessionCookie(sessionValue);
      return sendJson(res, 200, { authenticated: true, csrf: session.csrf });
    } catch (error) {
      if (error?.message === 'BODY_TOO_LARGE') return sendJson(res, 413, { error: 'BODY_TOO_LARGE' });
      return sendJson(res, 400, { error: 'INVALID_JSON' });
    }
  }

  function rejectAuth(res) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Hafize"');
    return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
  }

  function rejectCsrf(res) {
    return sendJson(res, 403, { error: 'CSRF_REQUIRED' });
  }

  function rejectRateLimit(res, retryAfterSeconds) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return sendJson(res, 429, { error: 'RATE_LIMITED', retryAfterSeconds });
  }

  function isProtectedApi(pathname) {
    return pathname === '/api/models'
      || pathname === '/api/agents'
      || pathname === '/api/chat'
      || pathname === '/api/agent/run'
      || pathname === '/api/connectors/canva/status'
      || pathname === '/api/connectors/gmail/status';
  }

  function checkCsrf(req, session) {
    if (!session?.csrf) return false;
    const candidate = req.headers['x-hafize-csrf'];
    if (typeof candidate !== 'string') return false;
    return constantTimeEquals(candidate, session.csrf);
  }

  function getPathname(url) {
    try {
      return new URL(url || '/', 'http://hafize.local').pathname;
    } catch {
      return '/';
    }
  }

  function requestIp(req) {
    if (parseBoolean(process.env.HAFIZE_TRUST_PROXY, false)) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim().slice(0, 200);
    }
    return String(req.socket?.remoteAddress || 'unknown').slice(0, 200);
  }

  async function readJson(req, maxBytes) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('BODY_TOO_LARGE');
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (!text) return {};
    return JSON.parse(text);
  }

  function readBearer(headers) {
    const value = headers?.authorization;
    const match = typeof value === 'string' ? /^Bearer ([^\s]+)$/i.exec(value.trim()) : null;
    return match ? match[1] : '';
  }

  function constantTimeEquals(left, right) {
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

  function parseBoolean(value, fallback) {
    if (value == null || value === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(value).trim());
  }

  function boundedInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
  }

  function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
  }

  function sendJson(res, status, payload) {
    setSecurityHeaders(res);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
  }
}
