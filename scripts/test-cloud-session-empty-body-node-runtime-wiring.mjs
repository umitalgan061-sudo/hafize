import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverRuntime = await readFile(new URL('../lib/cloud-session-node-server-runtime.mjs', import.meta.url), 'utf8');
const api = await readFile(new URL('../lib/cloud-session-http-api.mjs', import.meta.url), 'utf8');
const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

assert.match(serverRuntime, /createCloudSessionHttpApi/);
assert.match(serverRuntime, /const api = createHttpApi\(\{/);
assert.match(serverRuntime, /handle: \(args\) => api\.handle\(args\)/);
assert.match(api, /import \{ requireEmptyCloudSessionBody \}/);
assert.match(api, /pathname === STATUS_PATH[\s\S]*requireEmptyCloudSessionBody\(headers\)[\s\S]*auth\.authenticate/);
assert.match(api, /requireSameOrigin\(headers\);[\s\S]*pathname === LOGIN_PATH[\s\S]*requireEmptyCloudSessionBody\(headers\)[\s\S]*auth\.revoke/);

assert.match(server, /CLOUD_SESSION_NODE_SERVER_RUNTIME\.handle\(\{/);
assert.match(server, /\/api\/session\/login/);
assert.match(server, /\/api\/session\/status/);
assert.match(server, /\/api\/session\/logout/);
assert.equal(server.includes("url.pathname === '/api/session/status' && req.method === 'GET' && req.headers"), false);
assert.equal(server.includes('auth.authenticate({ headers: req.headers })'), false, 'server must not bypass session runtime auth policy');
assert.equal(server.includes('auth.revoke({ headers: req.headers })'), false, 'server must not bypass session runtime revocation policy');

for (const forbidden of ['.github/workflows', 'shell=True', 'shell: true', 'child_process.exec', 'child_process.spawn']) {
  assert.equal(api.includes(forbidden), false);
}

console.log('cloud session node runtime hardened API wiring: ok');
