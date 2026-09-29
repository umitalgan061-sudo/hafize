import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sources = [
  'public/typed/model-preferences.ts',
  'public/typed/model-preferences-ui.ts',
  'public/typed/app-shell.ts'
].map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]);

for (const [name, source] of sources) {
  assert.ok(!/fetch\s*\(/.test(source), name + ' must not fetch');
  assert.ok(!/XMLHttpRequest/.test(source), name + ' must not use XHR');
  assert.ok(!/WebSocket/.test(source), name + ' must not use WebSocket');
}

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
