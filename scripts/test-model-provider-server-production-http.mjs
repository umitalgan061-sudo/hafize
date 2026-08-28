import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'hafize-provider-http-'));
const observed = { modelRequests: 0, chatRequests: [] };

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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const ollamaPort = await reservePort();
const ollama = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/v1/models') {
    observed.modelRequests += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'tiny-local' }] }));
    return;
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    const body = await readBody(req);
    observed.chatRequests.push(body);
    assert.equal(body.model, 'tiny-local');
    assert.equal(body.stream, true);
    assert.equal('tools' in body, false);
    assert.equal('tool_choice' in body, false);
    assert.equal(Array.isArray(body.messages), true);
    assert.equal(body.messages[0].role, 'system');
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: {"choices":[{"delta":{"content":"yerel-ok"}}]}\n\ndata: [DONE]\n\n');
    return;
  }
  res.writeHead(404).end();
});
await new Promise((resolve, reject) => {
  ollama.once('error', reject);
  ollama.listen(ollamaPort, '127.0.0.1', resolve);
});

async function request(port, pathname, { method = 'GET', body } = {}) {
  const headers = { Accept: pathname === '/api/chat' ? 'text/event-stream' : 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(3_000)
  });
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text()
  };
}

async function waitForHealth(child, port, output) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`PROVIDER_SERVER_EXITED:${output.stderr}`);
    try {
      const response = await request(port, '/api/health');
      if (response.status === 200) return JSON.parse(response.text);
    } catch {
      // Socket not ready yet.
    }
    await delay(100);
  }
  throw new Error(`PROVIDER_SERVER_TIMEOUT:${output.stderr}`);
}

async function stop(child) {
  if (child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2_000)]);
  if (child.exitCode == null) child.kill('SIGKILL');
}

const port = await reservePort();
const output = { stdout: '', stderr: '' };
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    NVIDIA_API_KEY: '',
    GITHUB_TOKEN: '',
    HAFIZE_GITHUB_READ_REPOS: '',
    HAFIZE_LOCAL_PROVIDER_ENABLED: 'true',
    HAFIZE_LOCAL_PROVIDER_BASE_URL: `http://127.0.0.1:${ollamaPort}/v1`,
    HAFIZE_SCHEDULE_STORAGE_FILE: join(directory, 'schedule.enc'),
    HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: Buffer.alloc(32, 91).toString('base64'),
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
  assert.equal(health.nvidiaConfigured, false);
  assert.equal(health.localProviderConfigured, true);
  assert.equal(health.defaultModelProvider, 'nvidia');
  assert.equal(health.contextCompactionConfigured, true);

  let response = await request(port, '/api/models');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.text).models, ['local:tiny-local']);
  assert.equal(observed.modelRequests, 1);

  response = await request(port, '/api/chat', {
    method: 'POST',
    body: {
      model: 'local:tiny-local',
      agentId: 'minimal-engineer',
      messages: [{ role: 'user', content: 'Yerel yanıt ver.' }],
      max_tokens: 64,
      temperature: 0.2
    }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
  assert.match(response.text, /yerel-ok/);
  assert.match(response.text, /\[DONE\]/);
  assert.equal(observed.chatRequests.length, 1);

  assert.doesNotMatch(output.stdout + output.stderr, /tiny-local.*Authorization|Bearer\s+/i);
} finally {
  await stop(child);
  await new Promise((resolve) => ollama.close(resolve));
  await rm(directory, { recursive: true, force: true });
}

console.log('model provider production HTTP tests passed');
