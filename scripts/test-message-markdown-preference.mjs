import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown-preferences.js', import.meta.url), 'utf8');
assert.ok(file.includes("hafize.markdown-rendering.v1"));
assert.ok(file.includes("hafize:markdown-rendering-preference"));
assert.ok(file.includes("value ? 'on' : 'off'"));
assert.ok(file.includes("!== 'off'"));
assert.ok(file.includes('aria-pressed'));
assert.ok(file.includes('aria-label'));
assert.ok(file.includes('CustomEvent'));
assert.ok(file.includes('localStorage'));
assert.ok(file.includes('Biçimlendirme açık'));
assert.ok(file.includes('Biçimlendirme kapalı'));
assert.ok(!file.includes('fetch('));
console.log('markdown preference contract ok');
