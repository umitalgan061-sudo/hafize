import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERSONAL_MEMORY_APPROVAL_HTTP } from '../lib/personal-memory-http-api.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'hafize-memory-http-'));
const authToken = 'memory-http-auth-token-123456789012345';

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function reservePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function request(port, pathname, { method = 'GET', body, authorized = true, approvalToken = '' } = {}) {
  const headers = { Accept: 'application/json' };
  if (authorized) headers.Authorization = `Bearer ${authToken}`;
  if (approvalToken) headers[PERSONAL_MEMORY_APPROVAL_HTTP.header] = approvalToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(2_000)
  });
  return { status: response.status, body: await response.json() };
}

async function waitForHealth(child, port, output) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) throw new Error(`MEMORY_SERVER_EXITED:${output.stderr}`);
    try {
      const health = await request(port, '/api/health', { authorized: false });
      if (health.status === 200) return health;
    } catch {
      // Socket not ready yet.
    }
    await delay(100);
  }
  throw new Error(`MEMORY_SERVER_TIMEOUT:${output.stderr}`);
}

async function stop(child) {
  if (child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2_000)
  ]);
  if (child.exitCode == null) child.kill('SIGKILL');
}

const port = await reservePort();
const output = { stdout: '', stderr: '' };
const secretValues = [
  authToken,
  Buffer.alloc(32, 81).toString('base64'),
  Buffer.alloc(32, 82).toString('base64')
];
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    NVIDIA_API_KEY: '',
    GITHUB_TOKEN: '',
    HAFIZE_GITHUB_READ_REPOS: '',
    HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
    HAFIZE_CONNECTOR_AUTH_SUBJECT: 'memory-http-user',
    HAFIZE_CONNECTOR_OWNER_KEY_B64: secretValues[1],
    HAFIZE_MEMORY_KEY_B64: secretValues[2],
    HAFIZE_MEMORY_STORAGE_DIR: join(directory, 'memory'),
    HAFIZE_SCHEDULE_STORAGE_FILE: join(directory, 'schedule.enc'),
    HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: Buffer.alloc(32, 83).toString('base64'),
    HAFIZE_SCHEDULE_LEASE_PROVIDER: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => { output.stdout += chunk; });
child.stderr.on('data', (chunk) => { output.stderr += chunk; });

try {
  const health = await waitForHealth(child, port, output);
  assert.equal(health.body.memoryConfigured, true);
  for (const secret of secretValues) assert.equal(JSON.stringify(health.body).includes(secret), false);

  let response = await request(port, '/api/memory?query=Tenis', { authorized: false });
  assert.equal(response.status, 401);

  const writeBody = {
    kind: 'preference',
    content: 'Tenis oynamayı seviyorum',
    sourceType: 'user_statement',
    sensitivity: 'personal',
    explicitUserIntent: true
  };
  const prepared = await request(port, PERSONAL_MEMORY_APPROVAL_HTTP.path, {
    method: 'POST',
    body: { command: { kind: 'write', body: writeBody } }
  });
  assert.equal(prepared.status, 200);
  assert.deepEqual(prepared.body.command, { kind: 'write', body: writeBody });

  response = await request(port, '/api/memory', {
    method: 'POST',
    body: writeBody,
    approvalToken: prepared.body.approvalToken
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.record.content, 'Tenis oynamayı seviyorum');
  assert.equal('ownerId' in response.body.record, false);

  response = await request(port, '/api/memory?query=Tenis&limit=5');
  assert.equal(response.status, 200);
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.records[0].content, 'Tenis oynamayı seviyorum');
  assert.equal('ownerId' in response.body.records[0], false);

  for (const secret of secretValues) {
    assert.equal(output.stdout.includes(secret), false);
    assert.equal(output.stderr.includes(secret), false);
  }
} finally {
  await stop(child);
  await rm(directory, { recursive: true, force: true });
}

console.log('personal memory server HTTP tests passed');
