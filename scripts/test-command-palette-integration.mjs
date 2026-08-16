import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const palette = require('../public/command-palette.js');
const loader = require('../public/enhancements-loader.js');
const swPolicy = require('../public/sw-policy.js');
const source = fs.readFileSync(new URL('../public/command-palette.js', import.meta.url), 'utf8');

assert.ok(loader.ENHANCEMENTS.includes('/command-palette.js'));
assert.ok(swPolicy.SHELL_ASSETS.includes('/command-palette.js'));
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v50');
assert.equal(palette.COMMANDS.some((command) => command.selector === '#sendBtn'), false);
assert.equal(palette.COMMANDS.some((command) => command.selector === '#toolModeBtn'), false);
assert.equal(palette.COMMANDS.some((command) => command.selector === '#clearHistoryBtn'), false);

for (const forbidden of [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /localStorage/,
  /sessionStorage/,
  /navigator\.clipboard/,
  /requestSubmit\s*\(/,
  /\.submit\s*\(/
]) {
  assert.doesNotMatch(source, forbidden, `command palette must remain local-only: ${forbidden}`);
}

assert.match(source, /Ctrl \+ Shift \+ P|ctrlKey/);
assert.match(source, /metaKey/);
assert.match(source, /aria-modal/);
console.log('command palette integration boundary passed');
