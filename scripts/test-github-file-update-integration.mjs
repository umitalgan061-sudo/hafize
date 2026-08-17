import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const sourcePath = fileURLToPath(new URL('../public/github-file-update.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/github-file-update-style.js', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/github-file-update.css', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/GITHUB_FILE_UPDATE_UI_CONTRACT.md', import.meta.url));
const [source, style, loader, policy, css, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'), readFile(stylePath, 'utf8'), readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'), readFile(cssPath, 'utf8'), readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, stylePath, loaderPath, policyPath]) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || `${path} syntax failed`);
}

assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubFileUpdateStyle', '/github-file-update-style.js', 'data-hafize-github-file-update-style-loader')"), true);
assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubFileUpdate', '/github-file-update.js', 'data-hafize-github-file-update')"), true);
assert.equal(loader.split("'/github-file-update.js'").length - 1, 1);
assert.equal(loader.split("'/github-file-update-style.js'").length - 1, 1);
assert.equal(style.includes("link.href = '/github-file-update.css'"), true);

assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v72');
for (const asset of ['/github-file-update.js', '/github-file-update-style.js', '/github-file-update.css']) {
  assert.equal(swPolicy.SHELL_ASSETS.includes(asset), true, `${asset} must be cached`);
  assert.equal(swPolicy.classifyRequest({ method: 'GET', url: `https://hafize.example${asset}`, headers: {}, mode: 'cors' }, 'https://hafize.example'), 'shell');
}
assert.equal(swPolicy.classifyRequest({ method: 'POST', url: 'https://hafize.example/api/github/write/prepare', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'ignore');
assert.equal(swPolicy.classifyRequest({ method: 'GET', url: 'https://hafize.example/api/github/write/prepare', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'network-only');

assert.match(source, /MOUNT_TIMEOUT_MS = 10_000/);
assert.match(source, /MutationObserver/);
assert.match(source, /observer\.observe\(documentRef\.body/);
assert.match(source, /event\?\.key !== 'Escape'/);
assert.match(source, /aria-live/);
assert.match(source, /aria-busy/);
assert.match(source, /approvalToken/);
assert.match(source, /clearPrepared\(\{ announce: true \}\)/);

assert.match(css, /min-height: 44px/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /forced-colors: active/);
assert.match(css, /focus-visible/);
assert.match(css, /aria-invalid="true"/);

assert.match(doc, /iki aşamalı açık onay/i);
assert.match(doc, /expectedBlobSha/);
assert.match(doc, /\.github\/workflows/);
assert.match(doc, /64 KiB/);
assert.match(doc, /localStorage/);
assert.match(doc, /Dört profilli/);
assert.match(policy, /hafize-shell-v72/);

console.log('github file update integration tests passed');
