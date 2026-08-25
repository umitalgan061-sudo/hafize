import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/memory-consent-review.css', import.meta.url));
const sourcePath = fileURLToPath(new URL('../public/memory-consent-review.js', import.meta.url));
const [loader, css, source] = await Promise.all([
  readFile(loaderPath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(sourcePath, 'utf8')
]);

const loaderCall = "loadShellEnhancement('HafizeMemoryConsentReview', '/memory-consent-review.js', 'data-hafize-memory-consent-review')";
assert.equal(loader.includes(loaderCall), true);
assert.equal(loader.split("'/memory-consent-review.js'").length - 1, 1);
assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(swPolicy.SHELL_ASSETS.includes('/memory-consent-review.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/memory-consent-review.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/memory-consent-review.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/memory',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');

assert.match(source, /link\.href = '\/memory-consent-review\.css'/);
assert.match(source, /data-hafize-memory-consent-style/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /forced-colors:\s*active/);
assert.match(css, /memory-delete-confirming/);

console.log('memory consent integration tests passed');
