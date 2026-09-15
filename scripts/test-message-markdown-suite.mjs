import { spawn } from 'node:child_process';
import path from 'node:path';

const tests = [
  'test-message-markdown-source.mjs',
  'test-message-markdown-security.mjs',
  'test-message-markdown-formatting.mjs',
  'test-message-markdown-streaming.mjs',
  'test-message-markdown-links.mjs',
  'test-message-markdown-tools.mjs',
  'test-message-markdown-a11y.mjs',
  'test-message-markdown-pwa.mjs',
  'test-message-markdown-rich-syntax.mjs',
  'test-message-markdown-limits.mjs',
  'test-message-markdown-dom-boundary.mjs',
  'test-message-markdown-fallback.mjs',
  'test-message-markdown-renderer-pwa.mjs',
  'test-message-actions.mjs',
  'test-message-actions-security.mjs',
  'test-message-outline.mjs'
];

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join('scripts', file)], { stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

let failures = 0;
for (const test of tests) {
  const code = await run(test);
  if (code !== 0) failures += 1;
}
if (failures) {
  console.error(`${failures} markdown test paketi başarısız.`);
  process.exit(1);
}
console.log(`${tests.length} markdown test paketi tamamlandı.`);
