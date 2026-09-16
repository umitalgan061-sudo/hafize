import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRateLimiter } from '../lib/rate-limit.mjs';
import { createSessionAuth } from '../lib/session-auth.mjs';

const secret = 's'.repeat(64);
const connectorToken = 'c'.repeat(64);
const auth = createSessionAuth({ secret, subject: 'test-user', ttlSeconds: 300 });
assert.equal(auth.verifyCredential(secret), true);
assert.equal(auth.verifyCredential(`${secret}x`), false);
const value = auth.issueSession();
const session = auth.verifySessionCookie(value);
assert.equal(session.ok, true);
assert.equal(auth.authenticate({ cookie: auth.sessionCookieHeader(value).split(';')[0] }).csrf, session.csrf);
assert.equal(auth.verifySessionCookie(`${value}x`).ok, false);
assert.match(auth.sessionCookieHeader(value), /HttpOnly/);
assert.match(auth.sessionCookieHeader(value), /SameSite=Strict/);

const limiter = createRateLimiter({ windowMs: 60_000, max: 2, maxConcurrent: 1 });
const first = limiter.check('user', 1_000);
assert.equal(first.ok, true);
assert.equal(limiter.check('user', 1_001).concurrent, true);
assert.equal(limiter.check('user', 61_000).concurrent, true, 'live request must survive quota-window rotation');
first.release();
const second = limiter.check('user', 61_001);
assert.equal(second.ok, true);
second.release();
assert.equal(limiter.check('user', 61_002).ok, false);

const root = new URL('..', import.meta.url);
// The child binds port 0 and reports the port it got, so two suites running in
// parallel can never land on the same one.
const inlineServer = `import { createServer } from 'node:http';\nconst server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,path:req.url}));});server.listen(0,'127.0.0.1',()=>{process.stdout.write('HAFIZE_TEST_PORT='+server.address().port+'\\n');});`;
const child = spawn(process.execPath, ['--import', new URL('../lib/production-guard.mjs', import.meta.url).pathname, '--input-type=module', '-e', inlineServer], {
  cwd: root.pathname.replace(/\/$/, ''),
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '0',
    NODE_ENV: 'production',
    HAFIZE_AUTH_REQUIRED: 'true',
    HAFIZE_AUTH_TOKEN: secret,
    HAFIZE_CONNECTOR_AUTH_TOKEN: connectorToken,
    HAFIZE_CONNECTOR_AUTH_SUBJECT: 'connector-client'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
function announcedPort(stdout, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => { stdout.off('data', onData); reject(new Error('guarded server never reported a port')); }, timeoutMs);
    const onData = (chunk) => {
      buffer += String(chunk);
      const match = /HAFIZE_TEST_PORT=(\d+)/.exec(buffer);
      if (!match) return;
      clearTimeout(timer);
      stdout.off('data', onData);
      resolve(Number(match[1]));
    };
    stdout.on('data', onData);
  });
}

let port;
try {
  port = await announcedPort(child.stdout);
  let ready = false;
  // A cold Node start under a loaded checker can take seconds, so the budget is
  // generous; the loop still exits on the first guarded response.
  for (let i = 0; i < 200 && !ready; i += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/api/agents`); ready = response.status === 401; } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, 'production guard must reject protected requests before login');
  const connectorRejectedOutsideAgentRun = await fetch(`http://127.0.0.1:${port}/api/models`, {
    headers: { authorization: `Bearer ${connectorToken}` }
  });
  assert.equal(connectorRejectedOutsideAgentRun.status, 401, 'connector bearer must not become a general session credential');
  const connectorAgentRun = await fetch(`http://127.0.0.1:${port}/api/agent/run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${connectorToken}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(connectorAgentRun.status, 200, 'scoped connector bearer must reach the agent runtime');
  for (const path of ['/api/connectors/canva/status', '/api/connectors/gmail/status']) {
    const connectorStatus = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { authorization: `Bearer ${connectorToken}` }
    });
    assert.equal(connectorStatus.status, 200, `scoped connector bearer must reach ${path}`);
  }

  const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: secret }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  const payload = await login.json();
  assert.ok(cookie);
  const agents = await fetch(`http://127.0.0.1:${port}/api/agents`, { headers: { cookie } });
  assert.equal(agents.status, 200);
  const writeWithoutCsrf = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(writeWithoutCsrf.status, 403);
  const writeWithCsrf = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: 'POST', headers: { cookie, 'X-Hafize-CSRF': payload.csrf, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(writeWithCsrf.status, 200);
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

console.log('production hardening tests passed');
