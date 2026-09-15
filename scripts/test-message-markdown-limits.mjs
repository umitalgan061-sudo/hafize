import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown.js', import.meta.url), 'utf8');
assert.ok(file.includes('const MAX_INPUT = 24000'));
assert.ok(file.includes('const MAX_BLOCKS = 240'));
assert.ok(file.includes('const MAX_LINE = 1200'));
assert.ok(file.includes('slice(0, MAX_INPUT)'));
assert.ok(file.includes('blocks < MAX_BLOCKS'));
assert.ok(file.includes('slice(0, MAX_LINE)'));
assert.ok(file.includes('lang)'));
console.log('message markdown bounds contract ok');
