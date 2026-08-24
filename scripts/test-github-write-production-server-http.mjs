import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    HOST: '127.0.0.1',
    PORT: String(port),
    NVIDIA_API_KEY: '',
    GITHUB_TOKEN: '',
    HAFIZE_GITHUB_READ_REPOS: '',
    HAFIZE_GITHUB_WRITE_ENABLED: '',
    HAFIZE_GITHUB_WRITE_REPOS: '',
    HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: '',
    HAFIZE_GITHUB_WRITE_AUTH_TOKEN: '',
    HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: '',
    HAFIZE_GITHUB_WRITE_OWNER_KEY: '',
    HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL: '',
    HAFIZE_SCHEDULE_MODEL: '',
    HAFIZE_SCHEDULE_AUTH_TOKEN: '',
    HAFIZE_SCHEDULE_AUTH_SUBJECT: '',
    HAFIZE_SCHEDULE_STORAGE_FILE: '',
    HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: '',
    HAFIZE_SCHEDULE_LEASE_PROVIDER: '',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: '',
    HAFIZE_SCHEDULE_LEASE_MS: '',
    HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '',
    HAFIZE_SCHEDULE_REDIS_URL: ''
  };
}

function enabledEnv(port) {
  const approvalSecret = Buffer.alloc(32, 71).toString('base64url');
  const ownerKey = Buffer.alloc(32, 72).toString('base64url');
  return {
    env: {
      ...baseEnv(port),
      GITHUB_TOKEN: 'production-test-github-token',
      HAFIZE_GITHUB_WRITE_ENABLED: 'true',
      HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize',
      HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: approvalSecret,
      HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'production-test-owner-token',
      HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'production-test-owner',
      HAFIZE_GITHUB_WRITE_OWNER_KEY: ownerKey,
      HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL: 'redis://shared-replay:6379/0'
    },
    secrets: [approvalSecret, ownerKey, 'production-test-github-token', 'production-test-owner-token']
  };
}

function spawnServer(env) {
  const output = { stdout: '', stderr: '' };
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output.stdout += chunk; });
  child.stderr.on('data', (chunk) => { output.stderr += chunk; });
  return { child, output };
}

async function waitForExit(child, timeoutMs = 5_000) {
  if (child.exitCode != null) return child.exitCode;
  return Promise.race([
    new Promise((resolve) => child.once('exit', (code) => resolve(code))),
    delay(timeoutMs).then(() => null)
  ]);
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
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(1_500)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, headers: response.headers, body };
}

async function waitForHealth(child, port, output) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) throw new Error(`SERVER_EXITED:${output.stderr}`);
    try {
      const health = await request(port, '/api/health');
      if (health.status === 200) return health;
    } catch {
      // Socket is not ready yet.
    }
    await delay(100);
  }
  throw new Error(`SERVER_HEALTH_TIMEOUT:${output.stderr}`);
}

const command = {
  operation: 'branch.create',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/production-http-test',
  baseRef: 'main'
};

const disabledPort = await reservePort();
const disabled = spawnServer(baseEnv(disabledPort));
try {
  const health = await waitForHealth(disabled.child, disabledPort, disabled.output);
  assert.equal(health.body.githubWriteConfigured, false);
  const response = await request(disabledPort, '/api/github/write/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ignored-token' },
    body: JSON.stringify({ command })
  });
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'NOT_FOUND' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(disabled.output.stderr, '');
} finally {
  assert.equal(await stopServer(disabled.child), 0);
}

const enabledPort = await reservePort();
const enabledConfig = enabledEnv(enabledPort);
const enabled = spawnServer(enabledConfig.env);
try {
  const health = await waitForHealth(enabled.child, enabledPort, enabled.output);
  assert.equal(health.body.githubWriteConfigured, true);
  const serializedHealth = JSON.stringify(health.body);
  for (const secret of enabledConfig.secrets) assert.equal(serializedHealth.includes(secret), false);

  const unauthorized = await request(enabledPort, '/api/github/write/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command })
  });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(unauthorized.body, { error: 'AUTH_REQUIRED' });

  const prepared = await request(enabledPort, '/api/github/write/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer production-test-owner-token' },
    body: JSON.stringify({ command })
  });
  assert.equal(prepared.status, 200);
  assert.match(prepared.body.approvalToken, /^gw1\./);
  assert.equal(prepared.body.command?.repository, command.repository);
  assert.equal(prepared.body.command?.operation, command.operation);
  for (const secret of enabledConfig.secrets) {
    assert.equal(JSON.stringify(prepared.body).includes(secret), false);
    assert.equal(enabled.output.stdout.includes(secret), false);
    assert.equal(enabled.output.stderr.includes(secret), false);
  }
} finally {
  assert.equal(await stopServer(enabled.child), 0, `enabled server shutdown stderr: ${enabled.output.stderr}`);
}

const invalidPort = await reservePort();
const invalidConfig = enabledEnv(invalidPort);
invalidConfig.env.HAFIZE_GITHUB_WRITE_ENABLED = 'yes';
const invalid = spawnServer(invalidConfig.env);
try {
  const exitCode = await waitForExit(invalid.child);
  assert.notEqual(exitCode, null, 'invalid opt-in must terminate startup promptly');
  assert.notEqual(exitCode, 0);
  assert.match(invalid.output.stderr, /INVALID_GITHUB_WRITE_NODE_SERVER_RUNTIME:enabled/);
  for (const secret of invalidConfig.secrets) {
    assert.equal(invalid.output.stdout.includes(secret), false);
    assert.equal(invalid.output.stderr.includes(secret), false);
  }
  await assert.rejects(
    () => request(invalidPort, '/api/health'),
    /fetch failed|ECONNREFUSED|Connect Timeout|UND_ERR/
  );
} finally {
  await stopServer(invalid.child);
}

console.log('GitHub write production server HTTP tests passed');
