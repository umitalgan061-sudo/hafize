import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const fork = read('public/typed/conversation-forks.ts');
const core = read('public/typed/conversation-fork-core.ts');
const coreTest = read('public/typed/conversation-fork-core.test.ts');
const app = read('public/typed/app-shell.ts');
const html = read('public/index.html');
const vite = read('vite.config.ts');
const sw = read('public/sw-policy.ts');
const css = read('public/conversation-forks.css');

const requiredFiles = [
  'public/typed/conversation-forks.ts',
  'public/typed/conversation-fork-core.ts',
  'public/typed/conversation-fork-core.test.ts',
  'public/conversation-forks.css',
  'docs/CONVERSATION_FORKS.md',
  'docs/CONVERSATION_FORKS_DATA_MODEL.md',
  'docs/CONVERSATION_FORKS_PRIVACY.md',
  'docs/CONVERSATION_FORKS_RELEASE.md'
];
for (const file of requiredFiles) assert.equal(existsSync(file), true, file);

assert.match(core, /maxConversations: 30/);
assert.match(core, /maxMessages: 100/);
assert.match(core, /maxBranchesPerParent: 8/);
assert.match(core, /maxDepth: 4/);
assert.match(core, /maxForkNote: 400/);
assert.match(core, /function createFork/);
assert.match(core, /function conversationLineage/);
assert.match(core, /function buildForkSnapshot/);

assert.match(coreTest, /bounded custom branch title/);
assert.match(coreTest, /direct branch and total conversation limits/);
assert.match(coreTest, /caps fork depth and detects cycles/);
assert.match(coreTest, /builds a recovery snapshot/);

assert.match(fork, /Buradan dallandır/);
assert.match(fork, /Tüm dallar/);
assert.match(fork, /Dal karşılaştırması/);
assert.match(fork, /Fork noktası/);
assert.match(fork, /Dal yedeği/);
assert.match(fork, /Dal adı/);
assert.match(fork, /Dal notu/);
assert.match(fork, /conversation-fork-lineage/);
assert.match(fork, /conversation-fork-title-input/);
assert.match(fork, /conversation-fork-note-input/);
assert.match(fork, /HafizeConversationForks/);

for (const token of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'innerHTML =', 'outerHTML =']) {
  assert.equal(fork.includes(token), false, 'network or raw HTML primitive: ' + token);
}

assert.match(fork, /role', 'dialog'/);
assert.match(fork, /aria-modal/);
assert.match(fork, /aria-labelledby/);
assert.match(fork, /aria-describedby/);
assert.match(fork, /event.key === 'Escape'/);
assert.match(fork, /event.key === 'Tab'/);
assert.match(fork, /event.key === 'Enter'/);

assert.match(app, /forkOf?: string/);
assert.match(app, /forkMessageId?: string/);
assert.match(app, /forkDepth?: number/);
assert.match(app, /forkNote?: string/);
assert.match(app, /data-conversation-id/);
assert.match(app, /aria-busy/);
assert.match(app, /hafize:open-conversation/);

assert.match(html, /conversation-forks.css/);
assert.match(html, /typed-build\/conversation-forks\.js/);
assert.match(vite, /typed-build\/conversation-forks\.js/);
assert.match(vite, /typed\/conversation-forks\.ts/);
assert.match(vite, /'conversation-forks'/);
// The shell cache version is bumped on every shell change, so a literal version
// turns an unrelated change into a failure here. The invariant is what matters.
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'shell cache name carries a numeric version');
assert.match(sw, /conversation-forks.css/);
assert.match(sw, /typed-build\/conversation-forks\.js/);

assert.match(css, /conversation-fork-banner/);
assert.match(css, /conversation-fork-hub/);
assert.match(css, /conversation-fork-compare/);
assert.match(css, /forced-colors/);

console.log('conversation fork full regression gate: ok');
