import { timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { createSessionAuth, type SessionAuth } from './session-auth.ts';
import { createBearerPrincipalAuthenticator, type BearerPrincipalAuthenticator } from './server-auth.ts';
import { createRateLimiter, type RateLimiter } from './rate-limit.ts';
import { createSecurityEventLogger, type SecurityEventLogger } from './security-observability.ts';

type HeaderValue = string | string[] | undefined;
type Headers = Record<string, HeaderValue>;

interface HafizeRequest extends AsyncIterable<Uint8Array> {
  readonly url?: string;
  readonly method?: string;
  readonly headers: Headers;
  readonly socket?: { readonly remoteAddress?: string };
}

interface HafizeResponse {
  setHeader(name: string, value: string): void;
  getHeader(name: string): string | number | string[] | undefined;
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string): void;
  once(event: 'close' | 'finish', listener: () => void): void;
}

type Listener = (req: HafizeRequest, res: HafizeResponse) => unknown | Promise<unknown>;
type ServerFactory = (...args: unknown[]) => unknown;

interface ProtectedPrincipal {
  readonly ok: boolean;
  readonly session?: boolean;
  readonly connector?: boolean;
  readonly subject?: string;
  readonly csrf?: string;
}

interface HttpModule { createServer: ServerFactory; }

const http = createRequire(import.meta.url)('node:http') as HttpModule;
const guardKey = '__HAFIZE_PRODUCTION_GUARD__';
const isInstalled = (): boolean => Boolean((globalThis as Record<string, unknown>)[guardKey]);

if (!isInstalled()) {
  (globalThis as Record<string, unknown>)[guardKey] = true;

  const host = process.env.HOST || '127.0.0.1';
  const required = bool(process.env.HAFIZE_AUTH_REQUIRED, process.env.NODE_ENV === 'production' || host !== '127.0.0.1');
  const secret = (process.env.HAFIZE_AUTH_TOKEN || '').trim();
  const connectorToken = (process.env.HAFIZE_CONNECTOR_AUTH_TOKEN || '').trim();
  const connectorSubject = (process.env.HAFIZE_CONNECTOR_AUTH_SUBJECT || '').trim();

  if (required && secret.length < 32) throw new Error('HAFIZE_AUTH_TOKEN_REQUIRED_FOR_PUBLIC_RUNTIME');

  const auth: SessionAuth | null = secret
    ? createSessionAuth({
        secret,
        subject: process.env.HAFIZE_AUTH_SUBJECT,
        ttlSeconds: int(process.env.HAFIZE_AUTH_SESSION_TTL_SECONDS, 7 * 86400, 300, 30 * 86400),
        secureCookie: bool(process.env.HAFIZE_COOKIE_SECURE, process.env.NODE_ENV === 'production')
      })
    : null;
  const connectorAuth: BearerPrincipalAuthenticator | null = connectorToken && connectorSubject
    ? createBearerPrincipalAuthenticator({ token: connectorToken, subject: connectorSubject })
    : null;
  const security: SecurityEventLogger = createSecurityEventLogger();
  const loginLimit: RateLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, maxConcurrent: 1, maxEntries: 5000 });
  const apiLimit: RateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120, maxConcurrent: 8, maxEntries: 20000 });
  const chatLimit: RateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, maxConcurrent: 2, maxEntries: 20000 });
  const original = http.createServer;

  http.createServer = (...args: unknown[]): unknown => {
    const listenerIndex = args.length - 1;
    const listener = args[listenerIndex];
    if (typeof listener !== 'function') return original(...args);

    const wrapped: Listener = async (req, res) => {
      const path = pathname(req.url);
      const requestId = headerValue(req, 'x-request-id');
      try {
        res.setHeader('X-Hafize-Request-Id', security.record({
          event: 'request.received', requestId, route: path, method: req.method, outcome: 'received'
        }).requestId);
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
        const decision = limit.check(`${current.subject}:${path === '/api/chat' || path === '/api/agent/run' ? 'chat' : 'api'}`);
        if (!decision.ok) {
          security.record({
            event: 'rate.denied', requestId: res.getHeader('X-Hafize-Request-Id'), route: path,
            method: req.method, outcome: 'blocked', metadata: { concurrent: decision.concurrent === true }
          });
          return rate(res, decision.retryAfterSeconds);
        }
        res.once('close', decision.release);
        res.once('finish', decision.release);
        security.record({
          event: 'auth.allowed', requestId: res.getHeader('X-Hafize-Request-Id'), route: path,
          method: req.method, outcome: current.connector ? 'connector' : 'session'
        });
      } else if (!required && (path === '/api/chat' || path === '/api/agent/run')) {
        const decision = chatLimit.check(`ip:${ip(req)}`);
        if (!decision.ok) return rate(res, decision.retryAfterSeconds);
        res.once('close', decision.release);
        res.once('finish', decision.release);
      }
      return (listener as Listener)(req, res);
    };
    args[listenerIndex] = wrapped;
    return original(...args);
  };

  function protectedPath(path: string): boolean {
    return ['/api/models', '/api/agents', '/api/chat', '/api/agent/run', '/api/connectors/canva/status', '/api/connectors/gmail/status'].includes(path);
  }
  function connectorPath(path: string): boolean {
    return path === '/api/agent/run' || path === '/api/connectors/canva/status' || path === '/api/connectors/gmail/status';
  }
  function pathname(value?: string): string {
    try { return new URL(value || '/', 'http://hafize.local').pathname; } catch { return '/'; }
  }
  function headerValue(req: HafizeRequest, name: string): string | undefined {
    const value = req.headers[name.toLowerCase()];
    return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
  }
  function ip(req: HafizeRequest): string {
    const forwarded = headerValue(req, 'x-forwarded-for');
    return bool(process.env.HAFIZE_TRUST_PROXY, false) && forwarded
      ? forwarded.split(',')[0].trim().slice(0, 200)
      : String(req.socket?.remoteAddress || 'unknown').slice(0, 200);
  }
  function authenticateProtected(req: HafizeRequest, path: string): ProtectedPrincipal {
    const current = auth?.authenticate(req.headers);
    if (current?.ok) return { ok: true, session: true, subject: current.principal.subject, csrf: current.csrf };
    if (connectorPath(path) && connectorAuth) {
      const connector = connectorAuth.authenticate({ headers: req.headers });
      if (connector?.ok) return { ok: true, session: false, connector: true, subject: `connector:${connector.principal.subject}` };
    }
    return { ok: false };
  }
  function csrf(req: HafizeRequest, current: ProtectedPrincipal): boolean {
    return equal(headerValue(req, 'x-hafize-csrf'), current.csrf);
  }
  function equal(a?: string, b?: string): boolean {
    const x = Buffer.from(String(a ?? ''));
    const y = Buffer.from(String(b ?? ''));
    if (x.length !== y.length) {
      const padded = Buffer.alloc(y.length);
      x.copy(padded, 0, 0, Math.min(x.length, y.length));
      timingSafeEqual(padded, y);
      return false;
    }
    return timingSafeEqual(x, y);
  }
  function bool(value: string | undefined, fallback: boolean): boolean {
    return value == null || value === '' ? fallback : /^(1|true|yes|on)$/i.test(value.trim());
  }
  function int(value: string | undefined, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
  }
  function deny(res: HafizeResponse): void {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Hafize"');
    send(res, 401, { error: 'AUTH_REQUIRED' });
  }
  function rate(res: HafizeResponse, seconds: number): void {
    res.setHeader('Retry-After', String(seconds));
    send(res, 429, { error: 'RATE_LIMITED', retryAfterSeconds: seconds });
  }
  function send(res: HafizeResponse, status: number, body: Record<string, unknown>): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }
  async function json(req: HafizeRequest, max = 8192): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.byteLength;
      if (size > max) throw new Error('BODY_TOO_LARGE');
      chunks.push(Buffer.from(chunk));
    }
    const value = Buffer.concat(chunks).toString('utf8');
    return value ? JSON.parse(value) as Record<string, unknown> : {};
  }
  function session(req: HafizeRequest, res: HafizeResponse): void {
    if (!required) return send(res, 200, { required: false, authenticated: true, csrf: '' });
    const current = auth?.authenticate(req.headers);
    send(res, 200, { required: true, authenticated: Boolean(current?.ok), csrf: current?.ok ? current.csrf : '' });
  }
  async function login(req: HafizeRequest, res: HafizeResponse): Promise<void> {
    if (!auth) return send(res, 503, { error: 'AUTH_NOT_CONFIGURED' });
    const decision = loginLimit.check(`login:${ip(req)}`);
    if (!decision.ok) return rate(res, decision.retryAfterSeconds);
    res.once('close', decision.release);
    res.once('finish', decision.release);
    try {
      const body = await json(req);
      const authorization = headerValue(req, 'authorization') || '';
      const candidate = typeof body.token === 'string' ? body.token : authorization.replace(/^Bearer\s+/i, '');
      if (!auth.verifyCredential(candidate)) return deny(res);
      const value = auth.issueSession();
      const current = auth.verifySessionCookie(value);
      if (!current.ok) return deny(res);
      res.setHeader('Set-Cookie', auth.sessionCookieHeader(value));
      send(res, 200, { authenticated: true, csrf: current.csrf });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'INVALID_JSON';
      send(res, message === 'BODY_TOO_LARGE' ? 413 : 400, { error: message === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'INVALID_JSON' });
    }
  }
  function logout(req: HafizeRequest, res: HafizeResponse): void {
    const current = auth?.authenticate(req.headers);
    if (required && !current?.ok) return deny(res);
    if (current?.ok && !csrf(req, { ok: true, csrf: current.csrf })) return send(res, 403, { error: 'CSRF_REQUIRED' });
    res.setHeader('Set-Cookie', auth?.clearCookieHeader() || '');
    send(res, 200, { ok: true });
  }
}
