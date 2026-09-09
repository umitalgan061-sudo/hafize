import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const UPSTREAM_LEAK = 'nvapi-0123456789abcdefghijklmnop internal upstream trace';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reservePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  if (!port) throw new Error('TEST_PORT_UNAVAILABLE');
  return port;
}

// Stub NIM upstream: the status it answers with is controlled per request so the
// boundary can be checked for both a real error status and a non-error one.
async function startUpstream() {
  const state = { status: 500 };
  const server = createServer((req, res) => {
    res.writeHead(state.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: UPSTREAM_LEAK }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { state, port, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function startServer(port, upstreamPort) {
  const output = { stderr: '' };
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NVIDIA_API_KEY: 'test-key-not-a-real-credential',
      NIM_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
      GITHUB_TOKEN: '',
      HAFIZE_GITHUB_READ_REPOS: '',
      HAFIZE_SCHEDULE_AUTH_TOKEN: ''
    },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { output.stderr += chunk; });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) throw new Error(`SERVER_EXITED_BEFORE_HEALTH:${output.stderr}`);
    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (health.status === 200) return child;
    } catch {
      // Socket not accepting connections yet.
    }
    await delay(100);
  }
  throw new Error(`SERVER_HEALTH_TIMEOUT:${output.stderr}`);
}

const upstream = await startUpstream();
const port = await reservePort();
const child = await startServer(port, upstream.port);

try {
  const failed = await fetch(`http://127.0.0.1:${port}/api/models`, { signal: AbortSignal.timeout(2_000) });
  const failedBody = await failed.text();
  assert.equal(failed.status, 500, 'a real upstream error status is preserved');
  assert.deepEqual(JSON.parse(failedBody), { error: 'NVIDIA_MODELS_ERROR' });
  assert.equal(failedBody.includes('nvapi-'), false, 'upstream body must never reach the client');
  assert.equal(failedBody.includes('internal upstream trace'), false);

  upstream.state.status = 302;
  const redirected = await fetch(`http://127.0.0.1:${port}/api/models`, { signal: AbortSignal.timeout(2_000) });
  const redirectedBody = await redirected.text();
  assert.equal(redirected.status, 502, 'a non-error upstream status must not become a public failure status');
  assert.deepEqual(JSON.parse(redirectedBody), { error: 'NVIDIA_MODELS_ERROR' });
  assert.equal(redirectedBody.includes('nvapi-'), false);
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2_000)]);
  await upstream.close();
}

console.log('models endpoint boundary OK: upstream error bodies and non-error statuses stay out of the public response');
