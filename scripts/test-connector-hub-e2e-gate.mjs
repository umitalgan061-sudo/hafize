import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertModuleShipped, assertStylesheetShipped } from './shell-cache-contract.mjs';

const files = {
  hub: await readFile('public/typed/legacy/connector-hub.ts', 'utf8'),
  index: await readFile('public/index.html', 'utf8'),
  nav: await readFile('public/typed/workspace-navigation.ts', 'utf8'),
  sw: await readFile('public/sw-policy.ts', 'utf8'),
  server: await readFile('server.ts', 'utf8')
};

assert.match(files.hub, /\/api\/health/);
assert.match(files.hub, /\/api\/connectors\/gmail\/status/);
assert.match(files.hub, /\/api\/connectors\/canva\/status/);
assert.match(files.hub, /method:\s*['"]GET['"]/);
assert.match(files.hub, /credentials:\s*['"]same-origin['"]/);
assert.match(files.hub, /REQUEST_TIMEOUT_MS\s*=\s*8000/);
assert.match(files.hub, /REFRESH_COOLDOWN_MS\s*=\s*900/);
assert.match(files.hub, /hafize\.connector-hub\.v1/);
assert.match(files.hub, /CAPABILITIES/);
assert.match(files.hub, /getSnapshot/);

for (const id of ['accountConnectionCard','gmailConnectionCard','canvaConnectionCard','githubWriteReadinessCard']) {
  assert.match(files.nav, new RegExp(id));
  assert.match(files.hub, new RegExp(id));
}

// index.html and the shell cache are both checked by the shared helper.
assertStylesheetShipped('/connector-hub.css');
assertModuleShipped('connector-hub');
assert.match(files.server, /\/api\/connectors\/gmail\/status/);
assert.match(files.server, /\/api\/connectors\/canva\/status/);
assert.doesNotMatch(files.hub, /Authorization\s*:/);
assert.doesNotMatch(files.hub, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i);
assert.doesNotMatch(files.hub, /innerHTML\s*=/);
assert.doesNotMatch(files.hub, /localStorage/);

console.log('connector hub end-to-end gate: passed');
