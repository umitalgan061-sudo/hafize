import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../server.mjs', import.meta.url)));
const serverPath = join(rootDir, 'server.mjs');

function cleanEnvironment(port) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('HAFIZE_')) delete env[key];
  }
  delete env.NVIDIA_API_KEY;
  delete env.NIM_BASE_URL;
  delete env.GITHUB_TOKEN;
  env.HOST = '127.0.0.1';
  env.PORT = String(port);
  return env;
}

function capture(child) {
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return {
    stdout: () => stdout,
    stderr: () => stderr,
    combined: () => `${stdout}\n${stderr}`
  };
}

function spawnServer(env) {
  return spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function waitForExit(child, timeoutMs = 10_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('SERVER_PROCESS_EXIT_TIMEOUT'));
    }, timeoutMs);
    timer.unref?.();
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      timer = null;
      resolve({ code, signal });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      timer = null;
      reject(error);
    });
  });
}

function waitForText(child, output, pattern, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const inspect = () => {
      if (pattern.test(output.stdout())) finish(resolve);
    };
    const onExit = (code, signal) => finish(reject, new Error(
      `SERVER_EXITED_BEFORE_READY:${code ?? 'null'}:${signal || 'none'}:${output.combined().slice(0, 500)}`
    ));
    const timer = setTimeout(() => finish(reject, new Error('SERVER_START_TIMEOUT')), timeoutMs);
    timer.unref?.();
    function finish(callback, value) {
      clearTimeout(timer);
      child.stdout.off('data', inspect);
      child.off('exit', onExit);
      callback(value);
    }
    child.stdout.on('data', inspect);
    child.once('exit', onExit);
    inspect();
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function readJsonResponse(response) {
  const body = await response.json();
  return { response, body };
}

{
  const port = await getFreePort();
  const child = spawnServer(cleanEnvironment(port));
  const output = capture(child);
  try {
    await waitForText(child, output, /Hafize listening on http:\/\/127\.0\.0\.1:/);
    const origin = `http://127.0.0.1:${port}`;

    const health = await readJsonResponse(await fetch(`${origin}/api/health`));
    assert.equal(health.response.status, 200);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.body.googleOAuthConfigured, false);
    assert.equal(health.response.headers.get('cache-control'), 'no-store');
    assert.equal(health.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(JSON.stringify(health.body).includes('TOKEN'), false);
    assert.equal(JSON.stringify(health.body).includes('SECRET'), false);

    const start = await readJsonResponse(await fetch(`${origin}/api/connectors/gmail/oauth/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capabilities: ['gmail.read'] })
    }));
    assert.equal(start.response.status, 404);
    assert.deepEqual(start.body, { error: 'GOOGLE_OAUTH_NOT_CONFIGURED' });
    assert.equal(start.response.headers.get('cache-control'), 'no-store');

    const callback = await readJsonResponse(await fetch(
      `${origin}/api/connectors/gmail/oauth/callback?state=${'s'.repeat(43)}&code=authorization-code`
    ));
    assert.equal(callback.response.status, 404);
    assert.deepEqual(callback.body, { error: 'GOOGLE_OAUTH_NOT_CONFIGURED' });

    child.kill('SIGTERM');
    const exit = await waitForExit(child);
    assert.equal(exit.code, 0, output.combined());
    assert.equal(exit.signal, null);
  } finally {
    if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL');
  }
}

{
  const port = await getFreePort();
  const storageDir = await mkdtemp(join(tmpdir(), 'hafize-oauth-startup-'));
  const secret = `process-secret-${'x'.repeat(40)}`;
  const env = cleanEnvironment(port);
  Object.assign(env, {
    HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
    HAFIZE_CONNECTOR_AUTH_TOKEN: secret,
    HAFIZE_CONNECTOR_AUTH_SUBJECT: 'process@example.test',
    HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 17).toString('base64'),
    HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 19).toString('base64'),
    HAFIZE_OAUTH_TOKEN_STORAGE_DIR: storageDir
  });
  const child = spawnServer(env);
  const output = capture(child);
  try {
    const exit = await waitForExit(child);
    assert.notEqual(exit.code, 0, 'partial OAuth configuration must fail before the server listens');
    assert.equal(output.stdout().includes('Hafize listening'), false);
    assert.equal(output.combined().includes(secret), false, 'startup failure must not print connector bearer credentials');
    assert.equal(output.combined().includes('HAFIZE_GOOGLE_OAUTH_CLIENT_ID'), true,
      'startup failure should identify the missing configuration field without exposing its value');
  } finally {
    if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL');
    await rm(storageDir, { recursive: true, force: true });
  }
}

console.log('Google OAuth server process tests passed');
