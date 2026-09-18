import { createRequire } from 'node:module';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
// @ts-ignore Legacy session auth remains isolated behind this typed boundary.
import { createSessionAuth } from './session-auth.mjs';
import { createBearerPrincipalAuthenticator } from './server-auth.ts';
import { createRateLimiter } from './rate-limit.ts';
import { createSecurityEventLogger } from './security-observability.ts';

declare global {
  var __HAFIZE_PRODUCTION_GUARD__: boolean | undefined;
}

type RequestAuth = {
  readonly ok: boolean;
  readonly session?: boolean;
  readonly connector?: boolean;
  readonly subject?: string;
  readonly csrf?: string;
};

if (!globalThis.__HAFIZE_PRODUCTION_GUARD__) {
  globalThis.__HAFIZE_PRODUCTION_GUARD__ = true;
  const host = process.env.HOST || '127.0.0.1';
  const required = bool(process.env.HAFIZE_AUTH_REQUIRED, process.env.NODE_ENV === 'production' || host !== '127.0.0.1');
  const secret = (process.env.HAFIZE_AUTH_TOKEN || '').trim();
  const connectorToken = (process.env.HAFIZE_CONNECTOR_AUTH_TOKEN || '').trim();
  const connectorSubject = (process.env.HAFIZE_CONNECTOR_AUTH_SUBJECT || '').trim();
  if (required && secret.length < 32) throw new Error('HAFIZE_AUTH_TOKEN_REQUIRED_FOR_PUBLIC_RUNTIME');

  const auth = secret ? createSessionAuth({
    secret,
    subject: process.env.HAFIZE_AUTH_SUBJECT,
    ttlSeconds: int(process.env.HAFIZE_AUTH_SESSION_TTL_SECONDS, 7 * 86400, 300, 30 * 86400),
    secureCookie: bool(process.env.HAFIZE_COOKIE_SECURE, process.env.NODE_ENV === 'production')
  }) : null;
  const connectorAuth = connectorToken && connectorSubject
    ? createBearerPrincipalAuthenticator({ token: connectorToken, subject: connectorSubject })
    : null;
  const security = createSecurityEventLogger();
  const loginLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, maxConcurrent: 1, maxEntries: 5000 });
  const apiLimit = createRateLimiter({ windowMs: 60 * 1000, max: 120, maxConcurrent: 8, maxEntries: 20000 });
  const chatLimit = createRateLimiter({ windowMs: 60 * 1000, max: 20, maxConcurrent: 2, maxEntries: 20000 });

  const http = createRequire(import.meta.url)('node:http') as {
    createServer: (...args: unknown[]) => unknown;
  };
  const original = http.createServer;

  http.createServer = function hafizeCreateServer(...args: unknown[]): unknown {
    const index = args.length - 1;
    const listener = args[index];
    if (typeof listener !== 'function') return original.apply(http, args);

    args[index] = async (req: IncomingMessage, res: ServerResponse) => {
      const path = pathname(req.url);
      const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
      try {
        const record = security.record({ event: 'request.received', requestId, route: path, method: req.method, outcome: 'received' });
        res.setHeader('X-Hafize-Request-Id', record.requestId);
      } catch {}

      if (path === '/api/auth/session' && req.method === 'GET') return session(req, res);
      if (path === '/api/auth/login' && req.method === 'POST') return login(req, res);
      if (path === '/api/auth/logout' && req.method === 'POST') return logout(req, res);

      if (required && protectedPath(path)) {
        const current = authenticateProtected(req, path);
        if (!current.ok) {
          security.record({ event: 'auth.denied', requestId: res.getHeader('X-Hafize-Request-Id'), route: path, method: req.method, outcome: 'blocked' });
          return deny(res);
        }
        if (current.session && !['GET', 'HEAD', 'OPTIONS'].includes(req.method || '') && !csrf(req, current)) {
          security.record({ event: 'csrf.denied', requestId: res.getHeader('X-Hafize-Request-Id'), route: path, method: req.method, outcome: 'blocked' });
          return send(res, 403, { error: 'CSRF_REQUIRED' });
        }
        const limit = path === '/api/chat' || path === '/api/agent/run' ? chatLimit : apiLimit;
        const decision = limit.check(
          (current.subject || 'anonymous') + ':' + (path === '/api/chat' || path === '/api/agent/run' ? 'chat' : 'api')
        );
        if (!decision.ok) {
          security.record({
            event: 'rate.denied',
            requestId: res.getHeader('X-Hafize-Request-Id'),
            route: path,
            method: req.method,
            outcome: 'blocked',
            metadata: { concurrent: decision.concurrent === true }
          });
          return rate(res, decision.retryAfterSeconds);
        }
        res.once('close', decision.release);
        res.once('finish', decision.release);
        security.record({
          event: 'auth.allowed',
          requestId: res.getHeader('X-Hafize-Request-Id'),
          route: path,
          method: req.method,
          outcome: current.connector ? 'connector' : 'session'
        });
      } else if (!required && (path === '/api/chat' || path === '/api/agent/run')) {
        const decision = chatLimit.check('ip:' + ip(req));
        if (!decision.ok) return rate(res, decision.retryAfterSeconds);
        res.once('close', decision.release);
        res.once('finish', decision.release);
      }
      return listener(req, res);
    };
    return original.apply(http, args);
  };

  function protectedPath(path: string): boolean {
    return ['/api/models','/api/agents','/api/chat','/api/agent/run','/api/connectors/canva/status','/api/connectors/gmail/status'].includes(path);
  }
  function connectorPath(path: string): boolean {
    return path === '/api/agent/run' || path === '/api/connectors/canva/status' || path === '/api/connectors/gmail/status';
  }
  function pathname(value: string | undefined): string {
    try { return new URL(value || '/', 'http://hafize.local').pathname; } catch { return '/'; }
  }
  function ip(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    const address = req.socket?.remoteAddress || 'unknown';
    return bool(process.env.HAFIZE_TRUST_PROXY, false) && typeof forwarded === 'string'
      ? forwarded.split(',')[0]!.trim().slice(0, 200)
      : String(address).slice(0, 200);
  }
  function authenticateProtected(req: IncomingMessage, path: string): RequestAuth {
    const current = auth?.authenticate(req.headers);
    if (current?.ok) return { ok: true, session: true, subject: current.principal.subject, csrf: current.csrf };
    if (connectorPath(path) && connectorAuth) {
      const connector = connectorAuth.authenticate({ headers: req.headers });
      if (connector.ok) return { ok: true, session: false, connector: true, subject: 'connector:' + connector.principal.subject };
    }
    return { ok: false };
  }
  function csrf(req: IncomingMessage, current: RequestAuth): boolean {
    const value = req.headers['x-hafize-csrf'];
    return typeof value === 'string' && equal(value, current.csrf || '');
  }
  function equal(a: string, b: string): boolean {
    const left = Buffer.from(a), right = Buffer.from(b);
    if (left.length !== right.length) {
      const padded = Buffer.alloc(right.length);
      left.copy(padded, 0, 0, Math.min(left.length, right.length));
      timingSafeEqual(padded, right);
      return false;
    }
    return timingSafeEqual(left, right);
  }
  function bool(value: unknown, fallback: boolean): boolean {
    return value == null || value === '' ? fallback : /^(1|true|yes|on)$/i.test(String(value).trim());
  }
  function int(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value ? String(value) : '', 10);
    return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
  }
  function deny(res: ServerResponse): void {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Hafize"');
    send(res, 401, { error: 'AUTH_REQUIRED' });
  }
  function rate(res: ServerResponse, seconds: number): void {
    res.setHeader('Retry-After', String(seconds));
    send(res, 429, { error: 'RATE_LIMITED', retryAfterSeconds: seconds });
  }
  function send(res: ServerResponse, status: number, body: unknown): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }
  async function json(req: IncomingMessage, max = 8192): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      size += buffer.length;
      if (size > max) throw new Error('BODY_TOO_LARGE');
      chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  }
  function session(_req: IncomingMessage, res: ServerResponse): void {
    if (!required) return send(res, 200, { required: false, authenticated: true, csrf: '' });
    const current = auth?.authenticate(_req.headers);
    send(res, 200, { required: true, authenticated: Boolean(current?.ok), csrf: current?.ok ? current.csrf : '' });
  }
  async function login(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!auth) return send(res, 503, { error: 'AUTH_NOT_CONFIGURED' });
    const decision = loginLimit.check('login:' + ip(req));
    if (!decision.ok) return rate(res, decision.retryAfterSeconds);
    res.once('close', decision.release); res.once('finish', decision.release);
    try {
      const body = await json(req);
      const authorization = Array.isArray(req.headers.authorization) ? '' : req.headers.authorization || '';
      const candidate = typeof body.token === 'string' ? body.token : authorization.replace(/^Bearer\s+/i, '');
      if (!auth.verifyCredential(candidate)) return deny(res);
      const value = auth.issueSession();
      const current = auth.verifySessionCookie(value);
      res.setHeader('Set-Cookie', auth.sessionCookieHeader(value));
      send(res, 200, { authenticated: true, csrf: current.csrf });
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'BODY_TOO_LARGE';
      send(res, tooLarge ? 413 : 400, { error: tooLarge ? 'BODY_TOO_LARGE' : 'INVALID_JSON' });
    }
  }
  function logout(req: IncomingMessage, res: ServerResponse): void {
    const current = auth?.authenticate(req.headers);
    if (required && !current?.ok) return deny(res);
    if (current?.ok && !csrf(req, current)) return send(res, 403, { error: 'CSRF_REQUIRED' });
    res.setHeader('Set-Cookie', auth?.clearCookieHeader() || '');
    send(res, 200, { ok: true });
  }
}
