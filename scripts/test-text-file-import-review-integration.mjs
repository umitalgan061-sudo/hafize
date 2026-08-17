import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const styleLoaderPath = fileURLToPath(new URL('../public/text-file-import-style.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/text-file-import.css', import.meta.url));
const [loader, styleLoader, style] = await Promise.all([
  readFile(loaderPath, 'utf8'),
  readFile(styleLoaderPath, 'utf8'),
  readFile(stylePath, 'utf8')
]);

assert.equal(loader.includes("loadShellEnhancement('HafizeTextFileImportStyle', '/text-file-import-style.js', 'data-hafize-text-file-import-style-loader')"), true);
assert.equal(loader.includes("loadShellEnhancement('HafizeTextFileImport', '/text-file-import.js', 'data-hafize-text-file-import')"), true);
assert.equal(loader.split("'/text-file-import.js'").length - 1, 1);
assert.equal(loader.split("'/text-file-import-style.js'").length - 1, 1);

assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v79');
for (const asset of ['/text-file-import-style.js', '/text-file-import.js', '/text-file-import.css']) {
  assert.equal(swPolicy.SHELL_ASSETS.includes(asset), true, `${asset} must be cached`);
  assert.equal(swPolicy.classifyRequest({ method: 'GET', url: `https://hafize.example${asset}`, headers: {}, mode: 'cors' }, 'https://hafize.example'), 'shell');
}
assert.equal(swPolicy.classifyRequest({ method: 'POST', url: 'https://hafize.example/api/chat', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'ignore');

assert.equal(styleLoader.includes("link.href = '/text-file-import.css'"), true);
assert.equal(styleLoader.includes('data-hafize-text-file-import-style'), true);
assert.equal(styleLoader.includes('fetch('), false);

assert.match(style, /@media \(max-width: 680px\)/);
assert.match(style, /min-height: 44px/);
assert.match(style, /:focus-visible/);
assert.match(style, /prefers-reduced-motion: reduce/);
assert.match(style, /forced-colors: active/);
assert.match(style, /text-file-import-review/);
assert.match(style, /text-file-import-confirm/);

console.log('text file import review integration tests passed');
