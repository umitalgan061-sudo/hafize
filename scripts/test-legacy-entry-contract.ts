import { existsSync, readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(path, 'utf8');
const html = read('public/index.html');
const sw = read('public/sw-policy.ts');

const assert = (value: unknown, message: string): asserts value => {
  if (!value) throw new Error(`legacy-entry-contract: ${message}`);
};

const generated = [
  'markdown-renderer',
  'conversation-workspace',
  'prompt-library-smart-fill',
  'prompt-library-command-palette',
  'prompt-library-smart-fill-hints',
  'scheduled-tasks-countdown',
  'message-workspace',
  'prompt-library',
  'scheduled-tasks',
  'generation-control'
];

for (const name of generated) {
  if (name === 'generation-control') {
    assert(html.includes('/generation-control.css'), 'generation-control css');
    assert(existsSync('public/typed/generation-control.ts'), 'generation-control source');
    continue;
  }
  assert(!html.includes(`/${name}.js" defer`), `${name} legacy direct script`);
  assert(html.includes(`/typed-build/${name}.js`), `${name} generated entry`);
  assert(sw.includes(`/typed-build/${name}.js`), `${name} shell asset`);
}

for (const legacy of [
  'public/chat-markdown.js',
  'public/conversation-workspace.js',
  'public/markdown-renderer.js',
  'public/message-workspace.js',
  'public/prompt-library.js',
  'public/scheduled-tasks.js'
]) {
  assert(!existsSync(legacy), `obsolete bridge exists: ${legacy}`);
}

assert(existsSync('public/typed/hafize-api.ts'), 'typed API boundary missing');
assert(existsSync('public/typed/hafize-types.ts'), 'typed domain contracts missing');
assert(existsSync('public/typed/app-runtime.ts'), 'typed runtime surface missing');
assert(existsSync('public/typed/generation-history.ts'), 'generation history source missing');
assert(sw.includes('/generation-control.css'), 'generation-control is in PWA shell');

console.log('Legacy browser entry contract: OK');
