const LOGIN_PATH = '/api/session/login';
const STATUS_PATH = '/api/session/status';
const LOGOUT_PATH = '/api/session/logout';
const BODY_FIELDS = new Set(['password']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeOrigin(value) {
  let url;
  try { url = new URL(typeof value === 'string' ? value.trim() : ''); } catch { fail('INVALID_CLOUD_SESSION_HTTP:origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('INVALID_CLOUD_SESSION_HTTP:origin');
  return url.origin;
}

function header(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return typeof value === 'string' ? value.trim() : '';
}

function response(status, body, headers = {}) {
  return Object.freeze({ matched: true, status, body: Object.freeze(body), headers: Object.freeze({ 'cache-control': 'no-store', ...headers }) });
}

function exactLoginBody(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') fail('INVALID_CLOUD_SESSION_HTTP:body');
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys.some((key) => !BODY_FIELDS.has(key)) || typeof body.password !== 'string') fail('INVALID_CLOUD_SESSION_HTTP:body');
  return body.password;
}

function completeLoginGate(ticket, authenticated, countFailure = true) {
  if (!ticket || typeof ticket.complete !== 'function') return;
  ticket.complete({ authenticated: authenticated === true, countFailure: countFailure !== false });
}

function completeVerificationGate(ticket) {
  if (!ticket || typeof ticket.complete !== 'function') return;
  ticket.complete();
}

function retryAfterSeconds(ticket) {
  return Number.isSafeInteger(ticket?.retryAfterSeconds) && ticket.retryAfterSeconds > 0
    ? Math.min(ticket.retryAfterSeconds, 60)
    : 1;
}

export function createCloudSessionHttpApi({ auth, allowedOrigin, readJson, loginGate, verificationGate } = {}) {
  if (typeof auth?.login !== 'function' || typeof auth?.authenticate !== 'function' || typeof auth?.logoutCookie !== 'function') fail('INVALID_CLOUD_SESSION_HTTP:auth');
  if (auth.revoke != null && typeof auth.revoke !== 'function') fail('INVALID_CLOUD_SESSION_HTTP:auth');
  if (typeof readJson !== 'function') fail('INVALID_CLOUD_SESSION_HTTP:readJson');
  if (loginGate != null && typeof loginGate !== 'function') fail('INVALID_CLOUD_SESSION_HTTP:loginGate');
  if (verificationGate != null && typeof verificationGate !== 'function') fail('INVALID_CLOUD_SESSION_HTTP:verificationGate');
  const origin = normalizeOrigin(allowedOrigin);

  function requireSameOrigin(headers) {
    if (header(headers, 'origin') !== origin) fail('CLOUD_SESSION_ORIGIN_REQUIRED');
  }

  async function handle({ request, method, pathname, headers } = {}) {
    if (![LOGIN_PATH, STATUS_PATH, LOGOUT_PATH].includes(pathname)) return Object.freeze({ matched: false });
    let gateTicket = null;
    let verificationTicket = null;
    try {
      if (pathname === STATUS_PATH) {
        if (method !== 'GET') return response(405, { error: 'METHOD_NOT_ALLOWED' });
        const result = auth.authenticate({ headers });
        return result.ok
          ? response(200, { authenticated: true, expiresAt: result.expiresAt })
          : response(401, { authenticated: false, error: 'AUTH_REQUIRED' });
      }
      if (method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
      requireSameOrigin(headers);
      if (pathname === LOGIN_PATH) {
        gateTicket = await loginGate?.({ request, headers }) || null;
        if (gateTicket?.ok === false) {
          return response(429, { error: 'RATE_LIMITED' }, { 'retry-after': String(retryAfterSeconds(gateTicket)) });
        }
        const password = exactLoginBody(await readJson(request, headers));
        verificationTicket = await verificationGate?.({ request, headers }) || null;
        if (verificationTicket?.ok === false) {
          completeLoginGate(gateTicket, false, false);
          gateTicket = null;
          return response(503, { error: 'SESSION_AUTH_BUSY' }, { 'retry-after': String(retryAfterSeconds(verificationTicket)) });
        }
        const result = await auth.login({ password });
        completeVerificationGate(verificationTicket);
        verificationTicket = null;
        completeLoginGate(gateTicket, result.ok === true);
        gateTicket = null;
        return result.ok
          ? response(200, { authenticated: true, expiresAt: result.expiresAt }, { 'set-cookie': result.setCookie })
          : response(401, { authenticated: false, error: 'AUTH_REQUIRED' });
      }
      const current = typeof auth.revoke === 'function'
        ? auth.revoke({ headers })
        : auth.authenticate({ headers });
      if (!current.ok) {
        if (current.error === 'SESSION_REVOCATION_UNAVAILABLE') {
          return response(503, { authenticated: true, error: 'SESSION_REVOCATION_UNAVAILABLE' });
        }
        return response(401, { authenticated: false, error: 'AUTH_REQUIRED' });
      }
      return response(200, { authenticated: false }, { 'set-cookie': auth.logoutCookie() });
    } catch (error) {
      completeVerificationGate(verificationTicket);
      verificationTicket = null;
      completeLoginGate(gateTicket, false);
      gateTicket = null;
      const code = typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : '';
      if (error instanceof SyntaxError || code === 'INVALID_CLOUD_SESSION_HTTP:body') return response(400, { error: 'INVALID_REQUEST' });
      if (code === 'CLOUD_SESSION_ORIGIN_REQUIRED') return response(403, { error: 'ORIGIN_REQUIRED' });
      if (code === 'CLOUD_SESSION_BODY_TOO_LARGE') return response(413, { error: 'BODY_TOO_LARGE' }, { connection: 'close' });
      if (code === 'CLOUD_SESSION_BODY_TIMEOUT') return response(408, { error: 'REQUEST_TIMEOUT' }, { connection: 'close' });
      if (code === 'CLOUD_SESSION_UNSUPPORTED_MEDIA_TYPE') return response(415, { error: 'UNSUPPORTED_MEDIA_TYPE' });
      if (code === 'SESSION_REVOCATION_UNAVAILABLE') return response(503, { error: 'SESSION_REVOCATION_UNAVAILABLE' });
      return response(500, { error: 'SESSION_AUTH_FAILED' });
    }
  }

  return Object.freeze({ handle });
}

export const CLOUD_SESSION_HTTP_PATHS = Object.freeze({ login: LOGIN_PATH, status: STATUS_PATH, logout: LOGOUT_PATH });
