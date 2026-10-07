import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const files = [
  'public/typed/conversation-forks.ts',
  'public/typed/conversation-fork-core.ts',
  'public/typed/conversation-fork-core.test.ts',
  'public/conversation-forks.css',
  'public/index.html',
  'public/sw-policy.ts',
  'vite.config.ts',
  'README.md'
];

for (const file of files) assert.equal(existsSync(file), true, file);

const fork = readFileSync('public/typed/conversation-forks.ts', 'utf8');
const core = readFileSync('public/typed/conversation-fork-core.ts', 'utf8');
const app = readFileSync('public/typed/app-shell.ts', 'utf8');
const html = readFileSync('public/index.html', 'utf8');
const sw = readFileSync('public/sw-policy.ts', 'utf8');
const vite = readFileSync('vite.config.ts', 'utf8');

assert.match(fork, /hafize\.conversations\.v1/);
assert.match(fork, /Buradan dallandır/);
assert.match(fork, /Yeni dal oluştur/);
assert.match(fork, /Tüm dallar/);
assert.match(fork, /Karşılaştır/);
assert.match(fork, /Dal yedeği/);
assert.match(fork, /forkNote/);
assert.match(core, /maxBranchesPerParent: 8/);
assert.match(core, /maxDepth: 4/);
assert.match(core, /maxForkNote: 400/);
assert.match(app, /forkOf\?: string/);
assert.match(app, /forkNote\?: string/);
assert.match(app, /hafize:open-conversation/);
assert.match(html, /conversation-forks\.css/);
assert.match(html, /typed-build\/conversation-forks\.js/);
assert.match(vite, /conversation-forks/);
assert.match(sw, /conversation-forks\.css/);
assert.match(sw, /typed-build\/conversation-forks\.js/);

for (const token of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'innerHTML =', 'outerHTML =']) {
  assert.equal(fork.includes(token), false, token);
}

console.log('conversation fork release gate: ok');
