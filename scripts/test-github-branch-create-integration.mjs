import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');
const sourcePath = fileURLToPath(new URL('../public/github-branch-create.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/github-branch-create-style.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/github-branch-create.css', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const contractPath = fileURLToPath(new URL('../lib/github-write-contract.mjs', import.meta.url));
const apiPath = fileURLToPath(new URL('../lib/github-write-http-api.mjs', import.meta.url));
const [source, style, css, loader, contract, api] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(contractPath, 'utf8'),
  readFile(apiPath, 'utf8')
]);

for (const path of [sourcePath, stylePath, loaderPath, fileURLToPath(new URL('../public/sw-policy.js', import.meta.url))]) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || `${path} syntax failed`);
}

assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubBranchCreateStyle', '/github-branch-create-style.js', 'data-hafize-github-branch-create-style-loader')"), true);
assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubBranchCreate', '/github-branch-create.js', 'data-hafize-github-branch-create')"), true);
assert.equal(loader.split("'/github-branch-create.js'").length - 1, 1);
assert.equal(loader.split("'/github-branch-create-style.js'").length - 1, 1);

assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
for (const asset of ['/github-branch-create.js', '/github-branch-create-style.js', '/github-branch-create.css']) {
  assert.equal(swPolicy.SHELL_ASSETS.includes(asset), true, `${asset} missing from shell`);
  assert.equal(swPolicy.classifyRequest({ method: 'GET', url: `https://hafize.example${asset}`, headers: {}, mode: 'cors' }, 'https://hafize.example'), 'shell');
}
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/github/write/prepare',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/github/write/prepare',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');

assert.match(style, /href = '\/github-branch-create\.css'/);
assert.match(style, /data-hafize-github-branch-create-style/);
assert.match(css, /min-height: 44px/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /forced-colors: active/);
assert.match(css, /focus-visible/);

assert.match(contract, /HAFIZE_BRANCH_PREFIX = 'hafize\/'/);
assert.match(contract, /operation === 'branch\.create'/);
assert.match(contract, /GITHUB_WRITE_APPROVAL_REQUIRED/);
assert.match(api, /exactBody\(body, \['command'\]\)/);
assert.match(api, /exactBody\(body, \['command', 'approvalToken'\]\)/);
assert.match(api, /authenticator\.authenticate/);

assert.equal(source.includes("toggle.setAttribute('aria-expanded', 'false')"), true);
assert.equal(source.includes("status.setAttribute('aria-live', 'polite')"), true);
assert.equal(source.includes("status.setAttribute('aria-atomic', 'true')"), true);
assert.equal(source.includes("event?.key !== 'Escape'"), true);

console.log('github branch create integration tests passed');