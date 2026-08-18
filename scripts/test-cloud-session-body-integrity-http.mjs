import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_ENV } from '../lib/cloud-session-node-server-runtime.mjs';

const ORIGIN = 'https://hafize.example.test';
const env = {
  [CLOUD_SESSION_SERVER_ENV.passwordHash]: 'placeholder-password-hash',
  [CLOUD_SESSION_SERVER_ENV.signingKey]: 'placeholder-signing-key',
  [CLOUD_SESSION_SERVER_ENV.subject]: 'owner@example.test',
  [CLOUD_SESSION_SERVER_ENV.origin]: ORIGIN
};
let loginCalls = 0;
const auth = {
  async login({ password }) {
    loginCalls += 1;
    return password === 'correct'
      ? { ok: true, expiresAt: 9999, setCookie: '__Host-hafize_session=signed; Path=/; HttpOnly; Secure; SameSite=Strict' }
      : { ok: false, error: 'AUTH_REQUIRED' };
  },
  authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
};
const runtime = createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  loginAttempts: 20,
  maxRateKeys: 16
});

const server = createServer(async (req, res) => {
  const result = await runtime.handle({
    request: req,
    method: req.method,
    pathname: new URL(req.url || '/', 'http://localhost').pathname,
    headers: req.headers
  });
  res.writeHead(result.status, { 'content-type': 'application/json', ...result.headers });
  res.end(JSON.stringify(result.body));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.equal(typeof address, 'object');

function post(body, extraHeaders = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/session/login',
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'content-length': String(bytes.length),
        ...extraHeaders
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
        });
      });
    });
    req.on('error', reject);
    req.end(bytes);
  });
}

try {
  {
    const before = loginCalls;
    const result = await post('{"password":"correct"}');
    assert.equal(result.status, 200);
    assert.equal(result.body.authenticated, true);
    assert.equal(loginCalls, before + 1);
  }

  {
    const before = loginCalls;
    const invalid = Buffer.concat([
      Buffer.from('{"password":"'),
      Buffer.from([0xf0, 0x28, 0x8c, 0x28]),
      Buffer.from('"}')
    ]);
    const result = await post(invalid);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
    assert.equal(loginCalls, before, 'real IncomingMessage invalid UTF-8 must stop before auth.login');
  }

  {
    const before = loginCalls;
    const result = await post('{"password":"correct"}', { 'content-type': 'application/json; charset=iso-8859-1' });
    assert.equal(result.status, 415);
    assert.deepEqual(result.body, { error: 'UNSUPPORTED_MEDIA_TYPE' });
    assert.equal(loginCalls, before);
  }

  {
    const before = loginCalls;
    const result = await post('{"password":"correct"}', { 'content-encoding': 'gzip' });
    assert.equal(result.status, 415);
    assert.deepEqual(result.body, { error: 'UNSUPPORTED_MEDIA_TYPE' });
    assert.equal(loginCalls, before, 'compressed bytes must never reach password verification');
  }

  {
    const before = loginCalls;
    const result = await post('{"password":"wrong"}', { 'content-type': 'application/json; charset=UTF-8', 'content-encoding': 'identity' });
    assert.equal(result.status, 401);
    assert.equal(result.body.error, 'AUTH_REQUIRED');
    assert.equal(loginCalls, before + 1);
  }
} finally {
  server.close();
  await once(server, 'close');
}

console.log('cloud session body integrity HTTP tests passed');