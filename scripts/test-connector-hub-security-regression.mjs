import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
const source=await readFile('public/typed/legacy/connector-hub.ts','utf8');
const css=await readFile('public/connector-hub.css','utf8');
const sw=await readFile('public/sw-policy.ts','utf8');

for(const forbidden of [
  /Authorization\s*:/,
  /Bearer\s+/,
  /client_secret/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /innerHTML\s*=/,
  /outerHTML\s*=/,
  /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i,
  /fetch\(\s*['"]https?:\/\//
]) assert.doesNotMatch(source,forbidden);

assert.match(source,/textContent/);
assert.match(source,/sessionStorage/);
assert.match(source,/navigator\?\.clipboard/);
assert.match(source,/repository\.read/);
assert.match(css,/:focus-visible/);
assert.match(css,/max-width:700px/);
assertModuleDelivered('connector-hub');
assert.match(sw,/connector-hub\.css/);

console.log('connector hub security regression: passed');