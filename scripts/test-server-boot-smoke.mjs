// The server must actually start and answer a request.
//
// Static checks cannot see a boot failure: the runtime once imported a module
// that did not exist, so `npm start` died with ERR_MODULE_NOT_FOUND while the
// whole check gate stayed green. This suite boots the real entrypoint on a
// loopback port, asks /api/health and shuts it down again.
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOOT_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 250;

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function get(port, requestPath) {
  return new Promise((resolve, reject) => {
    // node:http is used directly so no proxy environment variable can
    // redirect a loopback request.
    const request = http.get({ host: '127.0.0.1', port, path: requestPath, timeout: 5_000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk.slice(0, 64 * 1024); });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('timeout', () => request.destroy(new Error('HEALTH_REQUEST_TIMEOUT')));
    request.on('error', reject);
  });
}

const port = await freePort();
const authToken = 'boot-smoke-' + 'a'.repeat(40);
const child = spawn(process.execPath, ['server.ts'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    NODE_ENV: 'development',
    HAFIZE_AUTH_TOKEN: authToken,
    NVIDIA_API_KEY: ''
  }
});

let output = '';
const capture = (chunk) => { if (output.length < 64 * 1024) output += chunk.toString('utf8'); };
child.stdout.on('data', capture);
child.stderr.on('data', capture);

let exited = null;
child.on('exit', (code, signal) => { exited = { code, signal }; });

async function waitForHealth() {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`server exited before answering (code ${exited.code}, signal ${exited.signal}):\n${output}`);
    }
    try {
      return await get(port, '/api/health');
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  throw new Error(`server did not answer /api/health in ${BOOT_TIMEOUT_MS} ms (${lastError?.message}):\n${output}`);
}

try {
  const health = await waitForHealth();
  assert.equal(health.status, 200, 'health endpoint must answer 200');

  const payload = JSON.parse(health.body);
  assert.equal(payload.status, 'ok', 'health payload must report ok');
  assert.equal(typeof payload.agents, 'number', 'health payload must report the agent count');
  assert.ok(payload.agents > 0, 'the agent registry must load at boot');
  assert.equal(typeof payload.readiness?.state, 'string', 'health payload must carry a readiness state');

  // Boot diagnostics and the health payload must never echo a configured secret.
  assert.ok(!health.body.includes(authToken), 'health payload leaked the auth secret');
  assert.ok(!output.includes(authToken), 'server log leaked the auth secret');

  // An unknown API path must be a clean 404 rather than a crash.
  const missing = await get(port, '/api/does-not-exist');
  assert.equal(missing.status, 404, 'unknown API paths must answer 404');

  // The server must still be alive after serving those requests.
  assert.equal(exited, null, `server exited while serving requests:\n${output}`);
} finally {
  if (!exited) {
    child.kill('SIGTERM');
    const stopped = await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 10_000))
    ]);
    if (stopped === 'timeout') child.kill('SIGKILL');
  }
}

console.log('server boot smoke: /api/health answered on a loopback port and shut down cleanly');
