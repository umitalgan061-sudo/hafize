import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShippedBrowserModule } from './shell-cache-contract.mjs';
import { assertNumericLimit } from './source-contract.mjs';

const source=await readFile('public/typed/legacy/connector-hub.ts','utf8');
const nav=await readFile('public/typed/workspace-navigation.ts','utf8');
const server=await readFile('server.ts','utf8');
const index=await readFile('public/index.html','utf8');

for(const id of ['accountConnectionCard','gmailConnectionCard','canvaConnectionCard','githubWriteReadinessCard']){
  assert.match(source,new RegExp(id));
  assert.match(nav,new RegExp(id));
}
assert.match(source,/refreshStatus\(\{ force: true \}\)/);
assert.match(source,/credentials:\s*['"]same-origin['"]/);
assertNumericLimit(source, 'REQUEST_TIMEOUT_MS', 8000);
assertNumericLimit(source, 'REFRESH_COOLDOWN_MS', 900);
assert.match(source,/destroyed/);
assert.match(source,/Tanı özeti/);
assert.match(server,/\/api\/health/);
assert.match(server,/\/api\/connectors\/gmail\/status/);
assert.match(server,/\/api\/connectors\/canva\/status/);
assert.match(index,/connector-hub\.css/);
assertShippedBrowserModule('connector-hub');

console.log('connector hub acceptance: passed');