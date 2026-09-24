import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const typed = [
  'public/markdown-renderer.ts',
  'public/conversation-workspace.ts',
  'public/typed/message-workspace.ts',
  'public/typed/prompt-library.ts',
  'public/typed/scheduled-tasks.ts'
];

// Legacy `.js` girişleri yalnızca typed-build çıktısına köprü kurar; uygulama
// mantığı taşımazlar.
const bridges = [
  'public/markdown-renderer.js',
  'public/conversation-workspace.js',
  'public/message-workspace.js',
  'public/prompt-library.js',
  'public/scheduled-tasks.js'
];

for (const path of typed) {
  const source = await read(path);
  assert.ok(source.includes('// @ts-nocheck'), `migration marker missing: ${path}`);
  assert.doesNotThrow(() => new Function(source), `typed browser source does not parse: ${path}`);
  assert.doesNotMatch(source, /(?:Authorization|Bearer\s+)/i, `auth credential text leaked into: ${path}`);
}

for (const path of bridges) {
  const source = await read(path);
  assert.doesNotThrow(() => new Function(source), `legacy bridge does not parse: ${path}`);
  assert.match(source, /import\('\/typed-build\//, `legacy bridge is not typed-build backed: ${path}`);
  assert.doesNotMatch(source, /(?:fetch|XMLHttpRequest|WebSocket)\s*\(/, `legacy bridge gained runtime/network logic: ${path}`);
}

console.log('TypeScript UI syntax smoke: OK');
