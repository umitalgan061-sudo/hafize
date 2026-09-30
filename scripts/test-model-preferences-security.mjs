import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
// The preference modules are device-local and must never reach the network.
// The app shell is the module that talks to `/api/`, so the contract there is
// narrower: it reads preferences locally and never sends them anywhere.
const sources = [
  'public/typed/model-preferences.ts',
  'public/typed/model-preferences-ui.ts'
].map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]);
const shell = fs.readFileSync(path.join(root, 'public/typed/app-shell.ts'), 'utf8');

for (const [name, source] of sources) {
  assert.ok(!/fetch\s*\(/.test(source), name + ' must not fetch');
  assert.ok(!/XMLHttpRequest/.test(source), name + ' must not use XHR');
  assert.ok(!/WebSocket/.test(source), name + ' must not use WebSocket');
}

assert.match(shell, /import \{ loadModelPreferences \} from '\.\/model-preferences\.ts'/);
assert.match(shell, /const preference = loadModelPreferences\(\);/);
assert.ok(!/XMLHttpRequest|WebSocket|navigator\.sendBeacon/.test(shell), 'the app shell uses fetch only');
// The preference object selects local UI state; it is never placed in a request body.
assert.ok(!/body:[^\n]*preference/.test(shell), 'preferences are not sent to the server');
assert.ok(!/preference\.[A-Za-z]+[^\n]*fetchJson/.test(shell), 'preferences are not sent to the server');

const state = sources[0][1];
const ui = sources[1][1];
assert.ok(!/password|client_secret|access_token|refresh_token/i.test(state));
assert.ok(!/navigator\.sendBeacon/.test(ui));
assert.match(state, /localStorage/);
assert.match(state, /maxImport: 200_000/);
assert.match(state, /maxExport: 200_000/);
assert.match(ui, /URL\.createObjectURL/);
assert.match(ui, /URL\.revokeObjectURL/);
assert.match(ui, /confirm\(/);
console.log('model preferences security contract ok');
