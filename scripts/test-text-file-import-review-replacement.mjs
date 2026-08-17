import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/text-file-import.js');

const composerInput = { value: '', dispatchEvent() { return true; }, focus() {}, setSelectionRange() {} };
const sendButton = { classList: { contains() { return false; } } };
const documentRef = {
  querySelector(selector) {
    if (selector === '#messageInput') return composerInput;
    if (selector === '#sendBtn') return sendButton;
    return null;
  },
  createElement() { return {}; }
};

const controller = api.createController({ documentRef, EventImpl: class {}, setTimeoutImpl: () => 1, clearTimeoutImpl() {} });
const good = { name: 'good.txt', type: 'text/plain', size: 4, async text() { return 'good'; } };
const bad = { name: 'bad.bin', type: 'application/octet-stream', size: 4, async text() { return 'bad'; } };

assert.equal(await controller.stageFiles([good]), true);
assert.equal(controller.snapshot().stagedCount, 1);
assert.equal(await controller.stageFiles([bad]), false);
assert.equal(controller.snapshot().stagedCount, 0, 'failed replacement must not leave old files staged');
assert.equal(controller.confirmStaged(), false);
assert.equal(composerInput.value, '');

assert.equal(await controller.stageFiles([good]), true);
assert.equal(controller.snapshot().stagedCount, 1);
assert.equal(await controller.stageFiles([]), false);
assert.equal(controller.snapshot().stagedCount, 1, 'empty file picker change is a no-op');
controller.clearStaged();
assert.equal(controller.snapshot().stagedCount, 0);

console.log('text file import replacement tests passed');
