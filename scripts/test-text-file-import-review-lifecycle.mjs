import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/text-file-import.js');

function classList(values = []) {
  const set = new Set(values);
  return { contains(value) { return set.has(value); }, add(value) { set.add(value); }, remove(value) { set.delete(value); } };
}

const composerInput = {
  value: 'Mevcut taslak',
  events: [],
  dispatchEvent(event) { this.events.push(event.type); return true; },
  focus() {},
  setSelectionRange() {}
};
const sendButton = { classList: classList() };
const documentRef = {
  querySelector(selector) {
    if (selector === '#messageInput') return composerInput;
    if (selector === '#sendBtn') return sendButton;
    return null;
  },
  createElement() { return {}; }
};
class FakeEvent { constructor(type) { this.type = type; } }

const controller = api.createController({ documentRef, EventImpl: FakeEvent, setTimeoutImpl: () => 1, clearTimeoutImpl() {} });
const files = [
  { name: 'a.txt', type: 'text/plain', size: 5, async text() { return 'alpha'; } },
  { name: 'b.md', type: 'text/markdown', size: 4, async text() { return 'beta'; } }
];

assert.equal(await controller.stageFiles(files), true);
assert.deepEqual(controller.snapshot(), { mounted: false, stagedCount: 2 });
assert.equal(composerInput.value, 'Mevcut taslak', 'staging must not mutate composer');
assert.deepEqual(composerInput.events, []);

assert.equal(controller.confirmStaged(), true);
assert.match(composerInput.value, /^Mevcut taslak\n\n--- Dosya: a\.txt ---/);
assert.match(composerInput.value, /--- Dosya: b\.md ---\nbeta\n--- Dosya sonu ---$/);
assert.deepEqual(composerInput.events, ['input']);
assert.equal(controller.snapshot().stagedCount, 0);

sendButton.classList.add('streaming');
assert.equal(await controller.stageFiles(files), false);
assert.equal(controller.snapshot().stagedCount, 0);
sendButton.classList.remove('streaming');

assert.equal(await controller.stageFiles([...files, files[0], files[1], files[0]]), false, 'more than four files must fail closed');
assert.equal(controller.snapshot().stagedCount, 0);

let resolveSlow;
const slow = { name: 'slow.txt', type: 'text/plain', size: 4, text() { return new Promise((resolve) => { resolveSlow = resolve; }); } };
const pending = controller.stageFiles([slow]);
controller.clearStaged();
resolveSlow('late');
assert.equal(await pending, false, 'cleared generation must reject late file reads');
assert.equal(controller.snapshot().stagedCount, 0);

console.log('text file import review lifecycle tests passed');
