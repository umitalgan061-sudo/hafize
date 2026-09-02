// End-to-end check that the configuration report reaches the operator's terminal:
// a half-configured group must stop startup with guidance instead of the raw
// destructuring stack trace that a runtime factory would otherwise produce.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function reservePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  return port;
}

function runServer(env) {
  const output = { stdout: '', stderr: '' };
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, HOST: '127.0.0.1', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output.stdout += chunk; });
  child.stderr.on('data', (chunk) => { output.stderr += chunk; });
  return { child, output };
}

function waitForExit(child) {
  return new Promise((resolve) => child.once('exit', (code) => resolve(code)));
}

// 1) A half-configured connector group aborts with an actionable message.
const partial = runServer({
  PORT: String(await reservePort()),
  HAFIZE_CONNECTOR_AUTH_TOKEN: 'a'.repeat(32),
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'owner'
});
const partialExit = await waitForExit(partial.child);
assert.equal(partialExit, 1, 'partial connector config must exit non-zero');
assert.match(partial.output.stderr, /Hafize başlatılamadı — yapılandırma eksik/);
assert.match(partial.output.stderr, /HAFIZE_OAUTH_TOKEN_KEY_B64/);
assert.match(partial.output.stderr, /docs\/KURULUM\.md/);
// The old failure mode was a raw stack trace from inside the token store.
assert.equal(partial.output.stderr.includes('INVALID_OAUTH_TOKEN_STORE_RUNTIME'), false);
assert.equal(partial.output.stderr.includes('Cannot destructure'), false);
// The configured half of the group must not be echoed back.
assert.equal(partial.output.stderr.includes('a'.repeat(32)), false);

// 2) A server with no configuration at all still starts and reports why chat is off.
const port = await reservePort();
const bare = runServer({ PORT: String(port) });
try {
  for (let attempt = 0; attempt < 50 && !bare.output.stdout.includes('yapılandırma durumu'); attempt += 1) {
    if (bare.child.exitCode != null) throw new Error(`SERVER_EXITED:${bare.output.stderr}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.match(bare.output.stdout, /Hafize yapılandırma durumu:/);
  assert.match(bare.output.stdout, /Sohbet kapalı: NVIDIA_API_KEY tanımlı değil/);
  assert.match(bare.output.stdout, /docs\/KURULUM\.md/);

  const health = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2_000) });
  assert.equal(health.status, 200, 'an unconfigured server must still serve health');
  assert.equal((await health.json()).nvidiaConfigured, false);
} finally {
  bare.child.kill('SIGTERM');
  await waitForExit(bare.child);
}

// 3) A configured key flips the summary without ever printing the key itself.
const keyPort = await reservePort();
const secretKey = 'nvapi-DO-NOT-PRINT-THIS-VALUE';
const configured = runServer({ PORT: String(keyPort), NVIDIA_API_KEY: secretKey });
try {
  for (let attempt = 0; attempt < 50 && !configured.output.stdout.includes('yapılandırma durumu'); attempt += 1) {
    if (configured.child.exitCode != null) throw new Error(`SERVER_EXITED:${configured.output.stderr}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(configured.output.stdout.includes('Sohbet kapalı'), false);
  assert.equal(configured.output.stdout.includes(secretKey), false, 'startup summary leaked the API key');
  assert.equal(configured.output.stderr.includes(secretKey), false, 'startup summary leaked the API key');

  const health = await fetch(`http://127.0.0.1:${keyPort}/api/health`, { signal: AbortSignal.timeout(2_000) });
  assert.equal((await health.json()).nvidiaConfigured, true);
} finally {
  configured.child.kill('SIGTERM');
  await waitForExit(configured.child);
}

console.log('setup status startup tests passed');
