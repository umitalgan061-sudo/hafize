import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
const data = new Map();
const listeners = new Map();
const sandbox = {
  localStorage: {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); }
  },
  crypto: { randomUUID: () => 'revision-runtime-id' },
  addEventListener(type, handler) { listeners.set(type, handler); },
  removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
  dispatchEvent() { return true; },
  setTimeout,
  clearTimeout,
  Event: class Event {},
  StorageEvent: class StorageEvent {
    constructor(type, init) { this.type = type; Object.assign(this, init); }
  }
};
vm.runInNewContext(source, sandbox);
const api = sandbox.HafizePromptLibraryRevisions;
assert.ok(api);
assert.equal(api.MAX_REVISIONS, 10);

const revision = api.normalizeRevision({ promptId: 'p1', title: '  Başlık  ', body: 'Metin', tags: ['kod', 'kod'], reason: 'manual' });
assert.equal(revision.promptId, 'p1');
assert.equal(revision.title, 'Başlık');
assert.equal(revision.tags.length, 1);
assert.equal(revision.reason, 'manual');

assert.equal(api.normalizeRevision({ promptId: 'p1', body: '' }), null);
api.writeAll({ p1: [revision] });
assert.equal(api.list('p1').length, 1);
assert.equal(api.list('missing').length, 0);
assert.equal(api.capture({ id: 'p1', title: 'Başlık', body: 'Metin', tags: ['kod'] }), false);

const second = { id: 'p1', title: 'Yeni', body: 'Yeni metin', tags: ['yeni'] };
assert.equal(api.capture(second), true);
assert.equal(api.list('p1')[0].title, 'Yeni');

const exported = JSON.parse(api.exportPrompt('p1'));
assert.equal(exported.version, 1);
assert.equal(exported.source, 'hafize-prompt-library-revisions');
assert.equal(exported.promptId, 'p1');
assert.equal(exported.revisions.length, 2);

assert.equal(api.remove('p1', api.list('p1')[0].id), true);
assert.equal(api.list('p1').length, 1);
assert.equal(api.clear('p1'), true);
assert.equal(api.list('p1').length, 0);

console.log('prompt revision runtime APIs: ok');
