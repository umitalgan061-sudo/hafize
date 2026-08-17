import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');

const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/github-write-activity-style.js', import.meta.url));
const prPath = fileURLToPath(new URL('../public/github-draft-pr-create.js', import.meta.url));
const filePath = fileURLToPath(new URL('../public/github-file-update.js', import.meta.url));
const [loader, style, prSource, fileSource] = await Promise.all([
  readFile(loaderPath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(prPath, 'utf8'),
  readFile(filePath, 'utf8')
]);

assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v73');
for (const asset of [
  '/github-write-activity-style.js',
  '/github-write-activity.js',
  '/github-write-activity.css'
]) {
  assert.equal(swPolicy.SHELL_ASSETS.includes(asset), true, `missing shell asset: ${asset}`);
  assert.equal(swPolicy.classifyRequest({
    method: 'GET',
    url: `https://hafize.example${asset}`,
    headers: {},
    mode: 'cors'
  }, 'https://hafize.example'), 'shell');
}

assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/github/write/execute',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/github/write/execute',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');

for (const expected of [
  "loadShellEnhancement('HafizeGitHubWriteActivityStyle', '/github-write-activity-style.js', 'data-hafize-github-write-activity-style-loader')",
  "loadShellEnhancement('HafizeGitHubWriteActivity', '/github-write-activity.js', 'data-hafize-github-write-activity')"
]) {
  assert.equal(loader.includes(expected), true, `missing loader wiring: ${expected}`);
}
assert.equal(loader.split("'/github-write-activity.js'").length - 1, 1);
assert.equal(loader.split("'/github-write-activity-style.js'").length - 1, 1);

assert.match(style, /link\.rel = 'stylesheet'/);
assert.match(style, /link\.href = '\/github-write-activity\.css'/);
assert.match(style, /data-hafize-github-write-activity-style/);

assert.match(prSource, /hafize:github-draft-pr-created/);
assert.match(prSource, /detail: Object\.freeze\(\{ prNumber: receipt\.prNumber \}\)/);
assert.match(fileSource, /hafize:github-file-updated/);
assert.match(fileSource, /path: snapshot\.command\.path, branch: snapshot\.command\.branch/);

console.log('github write activity integration tests passed');
