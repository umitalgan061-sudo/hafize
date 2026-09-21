import { createRequire } from 'node:module';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSessionAuth } from './session-auth.ts';
import { createBearerPrincipalAuthenticator } from './server-auth.ts';
import { createRateLimiter } from './rate-limit.ts';
import { createSecurityEventLogger } from './security-observability.ts';
import { parseRuntimeConfig } from './runtime-config.ts';

declare global { var __HAFIZE_PRODUCTION_GUARD__: boolean | undefined; }

type RequestAuth = {
  readonly ok: boolean;
  readonly session?: boolean;
  readonly connector?: boolean;
  readonly subject?: string;
  readonly csrf?: string;
};

if (!globalThis.__HAFIZE_PRODUCTION_GUARD__) {
  globalThis.__HAFIZE_PRODUCTION_GUARD__ = true;

  const config=parseRuntimeConfig(process.env);
  const { host, authRequired: required, authToken: secret, connectorAuthToken: connectorToken, connectorAuthSubject: connectorSubject } = config;
  const auth = secret ? createSessionAuth({
    secret,
    subject: config.authSubject,
    ttlSeconds: config.sessionTtlSeconds,
    secureCookie: config.cookieSecure
  }) : null;

  const connectorAuth = connectorToken && connectorSubject
    ? createBearerPrincipalAuthenticator({ token: connectorToken, subject: connectorSubject })
    : null;

  const security = createSecurityEventLogger();
  const loginLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, maxConcurrent: 1, maxEntries: 5000 });
  const apiLimit = createRateLimiter({ windowMs: 60 * 1000, max: 120, maxConcurrent: 8, maxEntries: 20000 });
  const chatLimit = createRateLimiter({ windowMs: 60 * 1000, max: 20, maxConcurrent: 2, maxEntries: 20000 });
  const http = createRequire(import.meta.url)('node:http') as { createServer: (...args: unknown[]) => unknown };
  const original = http.createServer;

  http.createServer = function patchedCreateServer(...args: unknown[]): unknown {
    const index = args.length - 1;
    const listener = args[index];
    if (typeof listener !== 'function') return original.apply(http, args);

    args[index] = async (req: IncomingMessage, res: ServerResponse) => {
      const path = pathOf(req.url);
      const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
      try {
        const event = security.record({ event: 'request.received', requestId, route: path, method: req.method, outcome: 'received' });
        res.setHeader('X-Hafize-Request-Id', event.requestId);
      } catch {}

      if (path === '/api/auth/session' && req.method === 'GET') return session(req, res);
      if (path === '/api/auth/login' && req.method === 'POST') return login(req, res);
      if (path === '/api/auth/logout' && req.method === 'POST') return logout(req, res);

      if (required && protectedPath(path)) {
        const current = protectedAuth(req, path);
        if (!current.ok) return deny(res);
        if (current.session && !safeMethod(req.method) && !checkCsrf(req, current.csrf)) {
          return send(res, 403, { error: 'CSRF_REQUIRED' });
        }
        const limiter = path === '/api/chat' || path === '/api/agent/run' ? chatLimit : apiLimit;
        const decision = limiter.check((current.subject || 'anonymous') + ':' + path);
        if (!decision.ok) return rate(res, decision.retryAfterSeconds);
        res.once('close', decision.release);
        res.once('finish', decision.release);
      } else if (!required && (path === '/api/chat' || path === '/api/agent/run')) {
        const decision = chatLimit.check('ip:' + remoteKey(req));
        if (!decision.ok) return rate(res, decision.retryAfterSeconds);
        res.once('close', decision.release);
        res.once('finish', decision.release);
      }

      return listener(req, res);
    };
    return original.apply(http, args);
  };

  function protectedPath(path: string): boolean {
    return ['/api/models','/api/agents','/api/chat','/api/agent/run','/api/connectors/canva/status','/api/connectors/gmail/status','/api/github/workspace','/api/github/workspace/directory','/api/github/workspace/compare','/api/github/workspace/commit','/api/github/workspace/pull'].includes(path);
  }
  function connectorPath(path: string): boolean {
    return path === '/api/agent/run' || path === '/api/connectors/canva/status' || path === '/api/connectors/gmail/status';
  }
  function pathOf(value: string | undefined): string {
    try { return new URL(value || '/', 'http://hafize.local').pathname; } catch { return '/'; }
  }
  function remoteKey(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (config.trustProxy && typeof forwarded === 'string') return forwarded.split(',')[0]!.trim().slice(0, 200);
    return String(req.socket?.remoteAddress || 'unknown').slice(0, 200);
  }
  function protectedAuth(req: IncomingMessage, path: string): RequestAuth {
    const sessionResult = auth?.authenticate(req.headers);
    if (sessionResult?.ok) return { ok: true, session: true, subject: sessionResult.principal.subject, csrf: sessionResult.csrf };
    if (connectorPath(path) && connectorAuth) {
      const result = connectorAuth.authenticate({ headers: req.headers });
      if (result.ok) return { ok: true, connector: true, subject: 'connector:' + result.principal.subject };
    }
    return { ok: false };
  }
  function checkCsrf(req: IncomingMessage, expected: string | undefined): boolean {
    const supplied = req.headers['x-hafize-csrf'];
    return typeof supplied === 'string' && typeof expected === 'string' && constantEqual(supplied, expected);
  }
  function constantEqual(a: string, b: string): boolean {
    const left=Buffer.from(a),right=Buffer.from(b);
    if(left.length!==right.length){const padded=Buffer.alloc(right.length);left.copy(padded,0,0,Math.min(left.length,right.length));timingSafeEqual(padded,right);return false;}
    return timingSafeEqual(left,right);
  }
  function safeMethod(method: string | undefined): boolean { return ['GET','HEAD','OPTIONS'].includes(method || ''); }
  function flag(value: unknown, fallback: boolean): boolean { return value == null || value === '' ? fallback : /^(1|true|yes|on)$/i.test(String(value).trim()); }
  function deny(res: ServerResponse): void { res.setHeader('WWW-Authenticate','Bearer realm="Hafize"'); send(res,401,{error:'AUTH_REQUIRED'}); }
  function rate(res: ServerResponse, seconds: number): void { res.setHeader('Retry-After',String(seconds)); send(res,429,{error:'RATE_LIMITED',retryAfterSeconds:seconds}); }
  function send(res: ServerResponse,status:number,body:unknown):void{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
  async function readBody(req:IncomingMessage,max=8192):Promise<Record<string,unknown>>{const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(String(chunk));size+=data.length;if(size>max)throw new Error('BODY_TOO_LARGE');chunks.push(data);}const value=Buffer.concat(chunks).toString('utf8');return(value?JSON.parse(value):{}) as Record<string,unknown>;}
  function session(_req:IncomingMessage,res:ServerResponse):void{if(!required)return send(res,200,{required:false,authenticated:true,csrf:''});const current=auth?.authenticate(_req.headers);send(res,200,{required:true,authenticated:Boolean(current?.ok),csrf:current?.ok?current.csrf:''});}
  async function login(req:IncomingMessage,res:ServerResponse):Promise<void>{if(!auth)return send(res,503,{error:'AUTH_NOT_CONFIGURED'});const decision=loginLimit.check('login:'+remoteKey(req));if(!decision.ok)return rate(res,decision.retryAfterSeconds);res.once('close',decision.release);res.once('finish',decision.release);try{const body=await readBody(req);const header=Array.isArray(req.headers.authorization)?'':req.headers.authorization||'';const credential=typeof body.token==='string'?body.token:header.replace(/^Bearer\s+/i,'');if(!auth.verifyCredential(credential))return deny(res);const value=auth.issueSession();const current=auth.verifySessionCookie(value);res.setHeader('Set-Cookie',auth.sessionCookieHeader(value));send(res,200,{authenticated:true,csrf:current.ok?current.csrf:''});}catch(error){const tooLarge=error instanceof Error&&error.message==='BODY_TOO_LARGE';send(res,tooLarge?413:400,{error:tooLarge?'BODY_TOO_LARGE':'INVALID_JSON'});}}
  function logout(req:IncomingMessage,res:ServerResponse):void{const current=auth?.authenticate(req.headers);if(required&&!current?.ok)return deny(res);if(current?.ok&&!checkCsrf(req,current.csrf))return send(res,403,{error:'CSRF_REQUIRED'});res.setHeader('Set-Cookie',auth?.clearCookieHeader()||'');send(res,200,{ok:true});}
}
