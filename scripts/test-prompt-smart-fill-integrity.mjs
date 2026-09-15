import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const core = fs.readFileSync('public/prompt-library-smart-fill.js', 'utf8');
const palette = fs.readFileSync('public/prompt-library-command-palette.js', 'utf8');

assert.match(html, /prompt-library-smart-fill\.js/);
assert.match(html, /prompt-library-command-palette\.js/);
assert.match(html, /prompt-library-smart-fill-hints\.js/);
assert.match(sw, /prompt-library-smart-fill\.js/);
assert.match(sw, /prompt-library-command-palette\.js/);
assert.match(sw, /prompt-library-smart-fill-hints\.js/);
assert.match(core, /messageInput/);
assert.match(core, /replaceVariables|extractVariables/);
assert.match(core, /MutationObserver/);
assert.match(palette, /Shift/);
assert.match(palette, /prompt/);
assert.doesNotMatch(core, /navigator\.sendBeacon/);
assert.doesNotMatch(core, /WebSocket/);
assert.doesNotMatch(palette, /WebSocket/);
console.log('prompt smart-fill integration integrity: ok');
