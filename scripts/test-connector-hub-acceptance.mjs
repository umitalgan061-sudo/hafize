import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile('public/connector-hub.js','utf8');
const nav=await readFile('public/workspace-navigation.js','utf8');
const server=await readFile('server.ts','utf8');
const index=await readFile('public/index.html','utf8');

for(const id of ['accountConnectionCard','gmailConnectionCard','canvaConnectionCard','githubWriteReadinessCard']){
  assert.match(source,new RegExp(id));
  assert.match(nav,new RegExp(id));
}
assert.match(source,/refreshStatus\(\{ force: true \}\)/);
assert.match(source,/credentials:\s*['"]same-origin['"]/);
assert.match(source,/REQUEST_TIMEOUT_MS\s*=\s*8000/);
assert.match(source,/REFRESH_COOLDOWN_MS\s*=\s*900/);
assert.match(source,/destroyed/);
assert.match(source,/Tanı özeti/);
assert.match(server,/\/api\/health/);
assert.match(server,/\/api\/connectors\/gmail\/status/);
assert.match(server,/\/api\/connectors\/canva\/status/);
assert.match(index,/connector-hub\.css/);
assert.match(index,/connector-hub\.js/);

console.log('connector hub acceptance: passed');