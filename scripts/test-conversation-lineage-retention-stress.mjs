import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

const validIds = new Set(['root']);
const rawEntries = [];
for (let index = 0; index < 200; index += 1) {
  const child = `branch-${index}`;
  validIds.add(child);
  rawEntries.push({
    childConversationId: child,
    parentConversationId: 'root',
    sourceMessageId: `m-${index}`,
    mode: index % 2 ? 'fork' : 'edit',
    createdAt: new Date(Date.UTC(2026, 7, 19, 0, 0, index)).toISOString()
  });
}

const parsed = api.parseEntries(JSON.stringify(rawEntries), validIds);
assert.equal(parsed.length, api.MAX_ENTRIES);
assert.equal(parsed[0].childConversationId, 'branch-0');
assert.equal(parsed.at(-1).childConversationId, `branch-${api.MAX_ENTRIES - 1}`);

const mixed = [];
for (let index = 0; index < 120; index += 1) {
  mixed.push({
    childConversationId: index % 3 === 0 ? `deleted-${index}` : `branch-${index}`,
    parentConversationId: 'root',
    sourceMessageId: `source-${index}`,
    mode: 'fork',
    createdAt: new Date(Date.UTC(2026, 7, 19, 1, 0, index)).toISOString()
  });
}
const mixedParsed = api.parseEntries(JSON.stringify(mixed), validIds);
assert.ok(mixedParsed.length <= api.MAX_ENTRIES);
assert.ok(mixedParsed.every((entry) => validIds.has(entry.childConversationId)));

const duplicateFlood = Array.from({ length: 200 }, (_, index) => ({
  childConversationId: 'branch-1',
  parentConversationId: 'root',
  sourceMessageId: `dup-${index}`,
  mode: 'fork',
  createdAt: new Date(Date.UTC(2026, 7, 19, 2, 0, index)).toISOString()
}));
assert.equal(api.parseEntries(JSON.stringify(duplicateFlood), validIds).length, 1);

const oversizedJson = JSON.stringify(rawEntries).padEnd(api.MAX_STORAGE_CHARS + 1, ' ');
assert.ok(oversizedJson.length > api.MAX_STORAGE_CHARS);
assert.equal(api.parseEntries(oversizedJson, validIds).length, 0);

const exactBoundary = JSON.stringify([]).padEnd(api.MAX_STORAGE_CHARS, ' ');
assert.equal(exactBoundary.length, api.MAX_STORAGE_CHARS);
assert.equal(api.parseEntries(exactBoundary, validIds).length, 0, 'non-canonical padded JSON is rejected by JSON parse');

console.log('conversation lineage retention stress tests passed');
