import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/connector-hub.js', 'utf8');

assert.match(source, /Intl\.DateTimeFormat\(['"]tr-TR['"]/);
assert.match(source, /rootRef\.setTimeout/);
assert.match(source, /rootRef\.clearTimeout/);
assert.match(source, /rootRef\.navigator/);
assert.match(source, /rootRef\.sessionStorage/);
assert.match(source, /rootRef\.fetch/);
assert.match(source, /documentRef\.createElement/);
assert.match(source, /documentRef\.createDocumentFragment/);
assert.doesNotMatch(source, /window\./);
assert.doesNotMatch(source, /document\.createElement/);
assert.match(source, /typeof rootRef\.fetch !== ['"]function['"]/);
assert.match(source, /typeof Controller === ['"]function['"]/);
assert.match(source, /try \{/);
assert.match(source, /catch \{/);

console.log('connector hub browser contract: passed');