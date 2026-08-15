import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const AUTH_TOKEN = 'oauth-production-auth-token-'.padEnd(48, 'x');
const OWNER_KEY = Buffer.alloc(32, 81).toString('base64');
const TOKEN_KEY = Buffer.alloc(32, 82).toString('base64');

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function reservePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error('TEST_PORT_UNAVAILABLE');
  return port;
}

function baseEnv(port) {
  return {
    ...process.env,
    HOST: '127.0.0.1', PORT: String(port), NVIDIA_API_KEY: '', GITHUB_TOKEN: '',
    HAFIZE_GITHUB_READ_REPOS: '', HAFIZE_CONNECTOR_AUTH_TOKEN: '', HAFIZE_CONNECTOR_AUTH_SUBJECT: '',
    HAFIZE_CONNECTOR_OWNER_KEY_B64: '', HAFIZE_GOOGLE_OAUTH_CLIENT_ID: '', HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: '',
    HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: '', HAFIZE_OAUTH_FLOW_REDIS_URL: '', HAFIZE_OAUTH_TOKEN_REDIS_URL: '',
    HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '', HAFIZE_OAUTH_TOKEN_KEY_B64: '', HAFIZE_GOOGLE_REFRESH_REDIS_URL: '',
    HAFIZE_SCHEDULE_MODEL: '', HAFIZE_SCHEDULE_AUTH_TOKEN: '', HAFIZE_SCHEDULE_AUTH_SUBJECT: '',
    HAFIZE_SCHEDULE_STORAGE_FILE: '', HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: '', HAFIZE_SCHEDULE_LEASE_PROVIDER: '',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: '', HAFIZE_SCHEDULE_REDIS_URL: ''
  };
}

function enabledEnv(port) {
  const redirectUri = `https://hafize.example.test/api/connectors/gmail/oauth/callback`;
  const env = {
    ...baseEnv(port),
    HAFIZE_CONNECTOR_AUTH_TOKEN: AUTH_TOKEN,
    HAFIZE_CONNECTOR_AUTH_SUBJECT: 'oauth-production-user',
    HAFIZE_CONNECTOR_OWNER_KEY_B64: OWNER_KEY,
    HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'oauth-production-client-id',
    HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: 'oauth-production-client-secret',
    HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: redirectUri,
    HAFIZE_OAUTH_FLOW_REDIS_URL: 'redis://oauth-flow.invalid:6379/0',
    HAFIZE_OAUTH_TOKEN_REDIS_URL: 'redis://oauth-token.invalid:6379/0',
    HAFIZE_OAUTH_TOKEN_KEY_B64: TOKEN_KEY,
    HAFIZE_GOOGLE_REFRESH_REDIS_URL: 'redis://oauth-refresh.invalid:6379/0'
  };
  return {
    env,
    secrets: [AUTH_TOKEN, OWNER_KEY, TOKEN_KEY, env.HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET,
      env.HAFIZE_OAUTH_FLOW_REDIS_URL, env.HAFIZE_OAUTH_TOKEN_REDIS_URL, env.HAFIZE_GOOGLE_REFRESH_REDIS_URL]
  };
}

function spawnServer(env) {
  const output = { stdout: '', stderr: '' };
  const child = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output.stdout += chunk; });
  child.stderr.on('data', (chunk) => { output.stderr += chunk; });
  return { child, output };
}

async function waitForExit(child, timeoutMs = 5_000) {
  if (child.exitCode != null) return child.exitCode;
  return Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(timeoutMs).then(() => null)]);
}

async function stopServer(child) {
  if (child.exitCode != null) return child.exitCode;
  child.kill('SIGTERM');
  const graceful = await waitForExit(child, 2_000);
  if (graceful != null) return graceful;
  child.kill('SIGKILL');
  return waitForExit(child, 2_000);
}

async function request(port, pathname, init = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { ...init, signal: AbortSignal.timeout(1_500) });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body, headers: response.headers };
}

async function waitForHealth(child, port, output) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) throw new Error(`SERVER_EXITED:${output.stderr}`);
    try {
      const health = await request(port, '/api/health');
      if (health.status === 200) return health;
    } catch { /* socket not ready */ }
    await delay(100);
  }
  throw new Error(`SERVER_HEALTH_TIMEOUT:${output.stderr}`);
}

const disabledPort = await reservePort();
const disabled = spawnServer(baseEnv(disabledPort));
try {
  const health = await waitForHealth(disabled.child, disabledPort, disabled.output);
  assert.equal(health.body.googleOAuthConfigured, false);
  const start = await request(disabledPort, '/api/connectors/gmail/oauth/start', { method: 'POST' });
  assert.deepEqual({ status: start.status, body: start.body }, { status: 404, body: { error: 'NOT_FOUND' } });
  const callback = await request(disabledPort, '/api/connectors/gmail/oauth/callback?state=x&code=y');
  assert.equal(callback.status, 404);
  assert.equal(start.headers.get('cache-control'), 'no-store');
  assert.equal(disabled.output.stderr, '');
} finally {
  assert.equal(await stopServer(disabled.child), 0);
}

const enabledPort = await reservePort();
const config = enabledEnv(enabledPort);
const enabled = spawnServer(config.env);
try {
  const health = await waitForHealth(enabled.child, enabledPort, enabled.output);
  assert.equal(health.body.googleOAuthConfigured, true);
  const serializedHealth = JSON.stringify(health.body);
  for (const secret of config.secrets) assert.equal(serializedHealth.includes(secret), false);

  const unauthenticated = await request(enabledPort, '/api/connectors/gmail/oauth/start', { method: 'POST' });
  assert.deepEqual({ status: unauthenticated.status, body: unauthenticated.body },
    { status: 401, body: { error: 'AUTH_REQUIRED' } });

  const wrongMethod = await request(enabledPort, '/api/connectors/gmail/oauth/start', {
    method: 'GET', headers: { authorization: `Bearer ${AUTH_TOKEN}` }
  });
  assert.equal(wrongMethod.status, 405);

  const forged = await request(enabledPort,
    '/api/connectors/gmail/oauth/callback?state=sssssssssssssssssssssssssssssssssssssssssss&code=authorization-code-123&ownerId=owner_attacker');
  assert.deepEqual({ status: forged.status, body: forged.body },
    { status: 400, body: { error: 'INVALID_OAUTH_CALLBACK' } });

  for (const secret of config.secrets) {
    assert.equal(enabled.output.stdout.includes(secret), false);
    assert.equal(enabled.output.stderr.includes(secret), false);
  }
} finally {
  assert.equal(await stopServer(enabled.child), 0);
}

console.log('Google OAuth production server HTTP tests passed');
