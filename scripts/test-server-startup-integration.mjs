import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEncryptedFileScheduleAdapter } from '../lib/encrypted-file-schedule-adapter.mjs';

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

async function waitForExit(child) {
  if (child.exitCode != null) return child.exitCode;
  return Promise.race([
    new Promise((resolve) => child.once('exit', (code) => resolve(code))),
    delay(5_000).then(() => null)
  ]);
}

async function stopChild(child) {
  if (child.exitCode != null) return child.exitCode;
  child.kill('SIGTERM');
  const exitCode = await Promise.race([
    new Promise((resolve) => child.once('exit', (code) => resolve(code))),
    delay(2_000).then(() => null)
  ]);
  if (exitCode != null) return exitCode;
  if (child.exitCode == null) child.kill('SIGKILL');
  if (child.exitCode != null) return child.exitCode;
  return new Promise((resolve) => child.once('exit', (code) => resolve(code)));
}

function createEnv({ port, storageFile, storageKey }) {
  return {
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
    HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: storageKey,
    HAFIZE_SCHEDULE_LEASE_PROVIDER: '',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: '',
    HAFIZE_SCHEDULE_LEASE_MS: '',
    HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '',
    HAFIZE_SCHEDULE_REDIS_URL: ''
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

async function assertHealthUnavailable(port) {
  try {
    await requestHealth(port);
    assert.fail('fail-closed startup must not expose health');
  } catch (error) {
    if (error?.code === 'ERR_ASSERTION') throw error;
  }
}

async function createEncryptedFixture(filePath, key) {
  const adapter = createEncryptedFileScheduleAdapter({ filePath, key });
  await adapter.save({ schemaVersion: 1, snapshot: { entries: [] } });
}

const directory = await mkdtemp(join(tmpdir(), 'hafize-server-startup-'));

try {
  const successPort = await reservePort();
  const successStorageFile = join(directory, 'schedule-success.enc');
  const successKeyBuffer = Buffer.alloc(32, 23);
  const successStorageKey = successKeyBuffer.toString('base64');
  const success = spawnServer(createEnv({
    port: successPort,
    storageFile: successStorageFile,
    storageKey: successStorageKey
  }));
  let successExitCode = null;

  try {
    const health = await waitForHealth(success.child, successPort, success.output);
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.body.nvidiaConfigured, false);
    assert.equal(health.body.githubReadConfigured, false);
    assert.equal(health.body.scheduleWorkerConfigured, false);
    assert.equal(health.body.scheduleApiConfigured, false);
    assert.equal(health.body.scheduleStorageDurable, true);
    assert.equal(health.body.scheduleLeaseConfigured, false);
    assert.equal(Number.isInteger(health.body.agents), true);
    assert.equal(health.body.agents > 0, true);
    assert.equal(success.output.stderr, '');
    assert.equal(success.output.stdout.includes(successStorageKey), false);
    assert.equal(JSON.stringify(health.body).includes(successStorageKey), false);

    // Bozuk istek gövdesi sunucu arızası gibi raporlanmamalı: `null`, dizi ve
    // ilkel gövdeler geçerli JSON olduğu için işleyicilerde ham TypeError'a ve
    // yanıltıcı bir 500'e yol açıyordu.
    for (const body of ['null', '42', '"metin"', '[]', 'gecersiz-json']) {
      const response = await fetch(`http://127.0.0.1:${successPort}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(2_000)
      });
      assert.equal(response.status, 400, `gövde ${body} 400 döndürmeli`);
      assert.deepEqual(await response.json(), { error: 'INVALID_JSON' }, `gövde ${body}`);
    }

    // Geçerli bir nesne gövdesi alan doğrulamasına ulaşmalı (500'e değil).
    const domainError = await fetch(`http://127.0.0.1:${successPort}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
      signal: AbortSignal.timeout(2_000)
    });
    assert.equal(domainError.status, 400);
    assert.deepEqual(await domainError.json(), { error: 'INVALID_CHAT_REQUEST' });
  } finally {
    successExitCode = await stopChild(success.child);
  }
  assert.equal(successExitCode, 0, 'SIGTERM should close the server runtime cleanly');

  const missingRedisPort = await reservePort();
  const missingRedisStorageFile = join(directory, 'schedule-missing-redis.enc');
  const missingRedisKey = Buffer.alloc(32, 31).toString('base64');
  const missingRedisServer = spawnServer({
    ...createEnv({
      port: missingRedisPort,
      storageFile: missingRedisStorageFile,
      storageKey: missingRedisKey
    }),
    HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'server-integration'
  });

  try {
    const exitCode = await waitForExit(missingRedisServer.child);
    assert.notEqual(exitCode, null, 'missing-redis startup should exit promptly');
    assert.notEqual(exitCode, 0, 'missing-redis startup should fail');
    await assertHealthUnavailable(missingRedisPort);
    assert.match(missingRedisServer.output.stderr, /SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED/);
    assert.equal(missingRedisServer.output.stderr.includes(missingRedisKey), false);
    assert.equal(missingRedisServer.output.stdout.includes(missingRedisKey), false);
  } finally {
    await stopChild(missingRedisServer.child);
  }

  const wrongKeyPort = await reservePort();
  const wrongKeyStorageFile = join(directory, 'schedule-wrong-key.enc');
  const fixtureKey = Buffer.alloc(32, 41);
  const wrongKey = Buffer.alloc(32, 42);
  await createEncryptedFixture(wrongKeyStorageFile, fixtureKey);
  const wrongKeyBase64 = wrongKey.toString('base64');
  const wrongKeyServer = spawnServer(createEnv({
    port: wrongKeyPort,
    storageFile: wrongKeyStorageFile,
    storageKey: wrongKeyBase64
  }));

  try {
    const exitCode = await waitForExit(wrongKeyServer.child);
    assert.notEqual(exitCode, null, 'wrong-key startup should exit promptly');
    assert.notEqual(exitCode, 0, 'wrong-key startup should fail');
    await assertHealthUnavailable(wrongKeyPort);
    assert.match(wrongKeyServer.output.stderr, /SCHEDULE_STORAGE_STARTUP_FAILED/);
    assert.equal(wrongKeyServer.output.stderr.includes(wrongKeyBase64), false);
    assert.equal(wrongKeyServer.output.stdout.includes(wrongKeyBase64), false);
    assert.equal(wrongKeyServer.output.stderr.includes('ENCRYPTED_SCHEDULE_LOAD_FAILED'), false);
  } finally {
    await stopChild(wrongKeyServer.child);
  }

  const corruptPort = await reservePort();
  const corruptStorageFile = join(directory, 'schedule-corrupt.enc');
  const corruptKey = Buffer.alloc(32, 57);
  const corruptKeyBase64 = corruptKey.toString('base64');
  await createEncryptedFixture(corruptStorageFile, corruptKey);
  const encryptedPayload = JSON.parse(await readFile(corruptStorageFile, 'utf8'));
  const ciphertext = Buffer.from(encryptedPayload.ciphertext, 'base64');
  ciphertext[0] ^= 0xff;
  encryptedPayload.ciphertext = ciphertext.toString('base64');
  await writeFile(corruptStorageFile, JSON.stringify(encryptedPayload), 'utf8');

  const corruptServer = spawnServer(createEnv({
    port: corruptPort,
    storageFile: corruptStorageFile,
    storageKey: corruptKeyBase64
  }));

  try {
    const exitCode = await waitForExit(corruptServer.child);
    assert.notEqual(exitCode, null, 'corrupt-ciphertext startup should exit promptly');
    assert.notEqual(exitCode, 0, 'corrupt-ciphertext startup should fail');
    await assertHealthUnavailable(corruptPort);
    assert.match(corruptServer.output.stderr, /SCHEDULE_STORAGE_STARTUP_FAILED/);
    assert.equal(corruptServer.output.stderr.includes(corruptKeyBase64), false);
    assert.equal(corruptServer.output.stdout.includes(corruptKeyBase64), false);
    assert.equal(corruptServer.output.stderr.includes('ENCRYPTED_SCHEDULE_LOAD_FAILED'), false);
  } finally {
    await stopChild(corruptServer.child);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('server startup integration tests passed');
