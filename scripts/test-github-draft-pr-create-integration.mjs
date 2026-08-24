import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/github-draft-pr-create.js', import.meta.url));
const styleLoaderPath = fileURLToPath(new URL('../public/github-draft-pr-create-style.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/github-draft-pr-create.css', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/GITHUB_DRAFT_PR_CREATE_UI_CONTRACT.md', import.meta.url));

const [source, styleLoader, css, loader, policy, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(styleLoaderPath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, styleLoaderPath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubDraftPrCreateStyle', '/github-draft-pr-create-style.js', 'data-hafize-github-draft-pr-create-style-loader')"), true);
assert.equal(loader.includes("loadShellEnhancement('HafizeGitHubDraftPrCreate', '/github-draft-pr-create.js', 'data-hafize-github-draft-pr-create')"), true);
assert.equal(loader.split("'/github-draft-pr-create.js'").length - 1, 1);
assert.equal(loader.split("'/github-draft-pr-create-style.js'").length - 1, 1);

assert.match(policy, /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}v\d+`/);
assert.match(policy, /'\/github-draft-pr-create\.js'/);
assert.match(policy, /'\/github-draft-pr-create-style\.js'/);
assert.match(policy, /'\/github-draft-pr-create\.css'/);
assert.match(policy, /pathname\.startsWith\('\/api\/'\).*network-only/s);

assert.match(styleLoader, /href = '\/github-draft-pr-create\.css'/);
assert.match(styleLoader, /data-hafize-github-draft-pr-create-style/);
assert.match(css, /min-height: 44px/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /forced-colors: active/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /event\?\.key !== 'Escape'/);
assert.match(source, /MOUNT_TIMEOUT_MS = 10_000/);
assert.match(source, /MutationObserver/);
assert.match(source, /approvalToken/);

assert.match(doc, /draft Pull Request/i);
assert.match(doc, /İki aşamalı açık onay/);
assert.match(doc, /replay protection/i);
assert.match(doc, /localStorage/);
assert.match(doc, /GITHUB_TOKEN/);
assert.match(doc, /yalnız `pr\.create`/i);

console.log('github draft PR create integration tests passed');
