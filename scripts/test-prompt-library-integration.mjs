import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../public/prompt-library.js', import.meta.url), 'utf8');
assert.ok(html.indexOf('/prompt-library.css') < html.indexOf('/prompt-library.js'));
assert.ok(html.indexOf('/prompt-library-starters.js') < html.indexOf('/voice-input.js'));
assert.match(source, /#messageInput/);
assert.match(source, /textarea\.value = replaceVariables/);
assert.match(source, /useCount/);
assert.match(source, /favoriteOnly/);
assert.match(source, /selected = new Set/);
assert.match(source, /MAX_SELECTION/);
assert.match(source, /MAX_IMPORT/);
console.log('test-prompt-library-integration: ok');
