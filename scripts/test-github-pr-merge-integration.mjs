import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const merge = require('../public/github-pr-merge.js');
const swPolicy = require('../public/sw-policy.js');

const sourcePath = fileURLToPath(new URL('../public/github-pr-merge.js', import.meta.url));
const styleLoaderPath = fileURLToPath(new URL('../public/github-pr-merge-style.js', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/github-pr-merge.css', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/GITHUB_PR_MERGE_UI_CONTRACT.md', import.meta.url));

const [source, styleLoader, loader, policy, css, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'), readFile(styleLoaderPath, 'utf8'), readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'), readFile(cssPath, 'utf8'), readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, styleLoaderPath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax failed`);
}

assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubPrMergeStyle', '/github-pr-merge-style.js', 'data-hafize-github-pr-merge-style-loader')"), true);
assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubPrMerge', '/github-pr-merge.js', 'data-hafize-github-pr-merge')"), true);
assert.equal(loader.split("'/github-pr-merge.js'").length - 1, 1);
assert.equal(loader.split("'/github-pr-merge-style.js'").length - 1, 1);
assert.equal(styleLoader.includes("link.href = '/github-pr-merge.css'"), true);
assert.equal(styleLoader.includes("data-hafize-github-pr-merge-style"), true);

assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
for (const asset of ['/github-pr-merge.js', '/github-pr-merge-style.js', '/github-pr-merge.css']) {
  assert.equal(swPolicy.SHELL_ASSETS.includes(asset), true, `${asset} missing from PWA shell`);
  assert.equal(swPolicy.classifyRequest({ method: 'GET', url: `https://hafize.example${asset}`, headers: {}, mode: 'cors' }, 'https://hafize.example'), 'shell');
}
assert.equal(swPolicy.classifyRequest({
  method: 'POST', url: 'https://hafize.example/api/github/write/execute', headers: { accept: 'application/json' }, mode: 'cors'
}, 'https://hafize.example'), 'ignore');
assert.equal(swPolicy.classifyRequest({
  method: 'GET', url: 'https://hafize.example/api/github/write/prepare', headers: { accept: 'application/json' }, mode: 'cors'
}, 'https://hafize.example'), 'network-only');

assert.equal(merge.REPOSITORY, 'umitalgan061-sudo/hafize');
assert.equal(source.includes("rootRef.CustomEvent('hafize:github-pr-merged'"), true);
assert.equal(source.includes("operation: 'pr.merge'"), true);
assert.equal(source.includes("method: 'POST'"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes('MOUNT_TIMEOUT_MS = 10_000'), true);
assert.equal(source.includes("event?.key === 'Escape'"), true);
assert.equal(source.includes("setAttribute('aria-live', 'polite')"), true);
assert.equal(source.includes("setAttribute('aria-atomic', 'true')"), true);
assert.equal(source.includes("approveButton.hidden = true"), true);
assert.equal(source.includes('Date.parse(prepared.expiresAt) <= now()'), true);

assert.match(css, /min-height:\s*44px/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /forced-colors:\s*active/);
assert.match(css, /focus-visible/);
assert.match(doc, /iki ayrı kullanıcı eylemi/i);
assert.match(doc, /expectedHeadSha/);
assert.match(doc, /auto-merge/i);
assert.match(doc, /localStorage/i);
assert.match(doc, /repo\.merge/);

console.log('github PR merge integration tests passed');
