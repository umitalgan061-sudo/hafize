import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/connector-hub.js', 'utf8');

assert.doesNotMatch(source, /localStorage/);
assert.match(source, /hafize\.connector-hub\.v1/);
assert.match(source, /sessionStorage/);
assert.match(source, /credentials:\s*['"]same-origin['"]/);
assert.doesNotMatch(source, /Authorization\s*:/);
assert.doesNotMatch(source, /Bearer\s+/);
assert.doesNotMatch(source, /client_secret/i);
assert.doesNotMatch(source, /access[_-]?token/i);
assert.doesNotMatch(source, /refresh[_-]?token/i);
assert.doesNotMatch(source, /oauth_token/i);
assert.doesNotMatch(source, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i);
assert.doesNotMatch(source, /fetch\(\s*['"]https?:\/\//);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /outerHTML\s*=/);
assert.match(source, /node\.textContent =/);
assert.match(source, /credentials:\s*['"]same-origin['"]/);
assert.match(source, //api\/health/);
assert.match(source, //api\/connectors\/gmail\/status/);
assert.match(source, //api\/connectors\/canva\/status/);

console.log('connector hub security: passed');