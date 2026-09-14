import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
assert.match(source, /function install\(/);
assert.match(source, /return \{ disconnect\(\) \{\} \}/);
assert.match(source, /markdownObserverInstalled/);
assert.match(source, /let queued = false/);
assert.match(source, /const schedule = \(\) =>/);
assert.match(source, /if \(queued\) return/);
assert.match(source, /queueMicrotask/);
assert.match(source, /observer\.disconnect\(\)/);

const installSection = source.slice(source.indexOf('function install('));
assert.match(installSection, /scan\(\)/);
assert.match(installSection, /MutationObserver\(schedule\)/);
assert.match(installSection, /messages\.addEventListener\('click'/);
assert.match(installSection, /closest\?\.\('\.md-code-copy'\)/);

const render = source.slice(source.indexOf('function renderMarkdown'), source.indexOf('function copyCode'));
assert.match(render, /replaceChildren/);
assert.match(render, /options\.placeholder/);
assert.match(render, /data/);

console.log('test-chat-markdown-lifecycle: ok');
