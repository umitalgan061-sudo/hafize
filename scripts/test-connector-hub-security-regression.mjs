import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile('public/connector-hub.js','utf8');
const css=await readFile('public/connector-hub.css','utf8');
const sw=await readFile('public/sw-policy.js','utf8');

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
assert.match(sw,/connector-hub\.js/);
assert.match(sw,/connector-hub\.css/);

console.log('connector hub security regression: passed');