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

const bridges = [
  'public/markdown-renderer.js',
  'public/conversation-workspace.js',
  'public/message-workspace.js',
  'public/prompt-library.js',
  'public/scheduled-tasks.js'
];

// The typed sources are TypeScript, so parsing them with `new Function` would
// reject ordinary annotations. `npm run typecheck:browser` is the parser/checker
// for these files; this gate keeps them inside that config and credential-free.
const browserTsconfig = JSON.parse(await read('tsconfig.browser.json'));
const packageData = JSON.parse(await read('package.json'));
assert.ok(browserTsconfig.include?.includes('public/**/*.ts'), 'browser typecheck must cover public/**/*.ts');
assert.match(String(packageData.scripts?.typecheck || ''), /typecheck:browser/, 'typecheck must run the browser config');

for (const path of typed) {
  const source = await read(path);
  assert.ok(!source.includes('@ts-nocheck'), `typed source must stay type-checked: ${path}`);
  assert.doesNotMatch(source, /(?:Authorization|Bearer\s+)/i, `auth credential text leaked into: ${path}`);
}

for (const path of bridges) {
  const source = await read(path);
  assert.doesNotThrow(() => new Function(source), `legacy bridge does not parse: ${path}`);
  assert.match(source, /import\('\/typed-build\//, `legacy bridge is not typed-build backed: ${path}`);
  assert.doesNotMatch(source, /(?:fetch|XMLHttpRequest|WebSocket)\s*\(/, `legacy bridge gained runtime/network logic: ${path}`);
}

console.log('TypeScript UI syntax smoke: OK');
