import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/connector-hub.js', 'utf8');

assert.match(source, /SESSION_KEY = ['"]hafize\.connector-hub\.v1['"]/);
assert.match(source, /getSessionStorage/);
assert.match(source, /readCollapsed/);
assert.match(source, /writeCollapsed/);
assert.match(source, /JSON\.parse\(raw \|\| ['"]\{\}['"]\)/);
assert.match(source, /collapsed === true/);
assert.match(source, /catch \{\n\s*return false;/);
assert.doesNotMatch(source, /getItem\([^)]*HEALTH_URL/);
assert.doesNotMatch(source, /setItem\([^)]*HEALTH_URL/);
assert.doesNotMatch(source, /setItem\([^)]*GMAIL_STATUS_URL/);
assert.doesNotMatch(source, /setItem\([^)]*CANVA_STATUS_URL/);

console.log('connector hub storage isolation: passed');