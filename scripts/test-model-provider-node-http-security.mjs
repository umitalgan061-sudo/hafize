import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createModelProviderNodeHttpRoute } from '../lib/model-provider-node-http-route.mjs';

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
    this.writableEnded = false;
  }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); }
  writeHead() {}
  write() { return true; }
  end() { this.writableEnded = true; }
}

function routeWithHeaders(headers) {
  return createModelProviderNodeHttpRoute({
    runtime: {
      async handle() {
        return { matched: true, status: 200, kind: 'json', body: { models: [] }, headers };
      }
    },
    sendJson(response) { response.end(); },
    setSecurityHeaders() {}
  });
}

for (const headers of [
  { Authorization: 'Bearer should-not-leak' },
  { Cookie: 'session=secret' },
  { 'Set-Cookie': 'session=secret' },
  { 'Proxy-Authorization': 'Basic secret' },
  { 'X-Test\r\nInjected': 'yes' },
  { 'X-Test': 'safe\r\nInjected: yes' }
]) {
  await assert.rejects(
    () => routeWithHeaders(headers).handle({ request: {}, response: new FakeResponse(), method: 'GET', pathname: '/api/models' }),
    /INVALID_MODEL_PROVIDER_NODE_HTTP_HEADERS/
  );
}

{
  const route = routeWithHeaders({ 'X-Hafize-Provider': 'local', 'Cache-Control': 'no-store' });
  const response = new FakeResponse();
  await route.handle({ request: {}, response, method: 'GET', pathname: '/api/models' });
  assert.equal(response.headers.get('x-hafize-provider'), 'local');
  assert.equal(response.headers.get('cache-control'), 'no-store');
}

const source = await readFile(new URL('../lib/model-provider-node-http-route.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(source, /process\.env|NVIDIA_API_KEY|GITHUB_TOKEN|child_process|\bexec\s*\(|\bspawn\s*\(|shell\s*:/);
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
assert.match(source, /AbortController/);
assert.match(source, /STREAM_INTERRUPTED/);
assert.match(source, /FORBIDDEN_RESPONSE_HEADERS/);

console.log('model provider Node HTTP security tests passed');
