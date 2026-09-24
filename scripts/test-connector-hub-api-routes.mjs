import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile('server.ts', 'utf8');

assert.match(server, /url\.pathname === ['"]\/api\/health['"]/);
assert.match(server, /url\.pathname === ['"]\/api\/connectors\/canva\/status['"]/);
assert.match(server, /url\.pathname === ['"]\/api\/connectors\/gmail\/status['"]/);
assert.match(server, /githubReadConfigured:/);
assert.match(server, /canvaReadConfigured:/);
assert.match(server, /gmailReadConfigured:/);
assert.match(server, /sendJson\(res, 200, \{ linked: status\.linked \}\)/);
assert.match(server, /status\.error === ['"]AUTH_REQUIRED['"]/);
assert.doesNotMatch(server, /api\/connectors\/canva\/status['"][^\n]*(POST|PUT|PATCH|DELETE)/);
assert.doesNotMatch(server, /api\/connectors\/gmail\/status['"][^\n]*(POST|PUT|PATCH|DELETE)/);

console.log('connector hub server routes: passed');