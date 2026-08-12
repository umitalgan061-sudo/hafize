import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

async function requestHealth(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(1_000)
  });
  return { status: response.status, body: await response.json() };
}

async function waitForHealth(child, port, output) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) {
      throw new Error(`SERVER_EXITED_BEFORE_HEALTH:${output.stderr}`);
    }
    try {
      const health = await requestHealth(port);
      if (health.status === 200) return health;
    } catch {
      // Server socket is not ready yet.
    }
    await delay(100);
  }
  throw new Error(`SERVER_HEALTH_TIMEOUT:${output.stderr}`);
}

async function stopChild(child) {
  if (child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2_000).then(() => {
      if (child.exitCode == null) child.kill('SIGKILL');
    })
  ]);
}

const directory = await mkdtemp(join(tmpdir(), 'hafize-server-startup-'));
const port = await reservePort();
const output = { stdout: '', stderr: '' };
const storageFile = join(directory, 'schedule.enc');
const storageKey = Buffer.alloc(32, 23).toString('base64');

const env = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(port),
  NVIDIA_API_KEY: '',
  GITHUB_TOKEN: '',
  HAFIZE_GITHUB_READ_REPOS: '',
  HAFIZE_SCHEDULE_MODEL: '',
  HAFIZE_SCHEDULE_AUTH_TOKEN: '',
  HAFIZE_SCHEDULE_AUTH_SUBJECT: '',
  HAFIZE_SCHEDULE_STORAGE_FILE: storageFile,
  HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: storageKey
};

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT,
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => { output.stdout += chunk; });
child.stderr.on('data', (chunk) => { output.stderr += chunk; });

try {
  const health = await waitForHealth(child, port, output);
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.nvidiaConfigured, false);
  assert.equal(health.body.githubReadConfigured, false);
  assert.equal(health.body.scheduleWorkerConfigured, false);
  assert.equal(health.body.scheduleApiConfigured, false);
  assert.equal(health.body.scheduleStorageDurable, true);
  assert.equal(Number.isInteger(health.body.agents), true);
  assert.equal(health.body.agents > 0, true);
  assert.equal(output.stderr, '');
  assert.equal(output.stdout.includes(storageKey), false);
  assert.equal(JSON.stringify(health.body).includes(storageKey), false);
} finally {
  await stopChild(child);
  await rm(directory, { recursive: true, force: true });
}

console.log('server startup integration tests passed');
