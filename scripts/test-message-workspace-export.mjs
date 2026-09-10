import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const policy = require(path.join(root, 'public/message-workspace-policy.js'));
const source = await readFile(path.join(root, 'public/message-workspace.js'), 'utf8');

function record(index) {
  return policy.normalizeRecord({
    id: `r-${index}`,
    conversationId: 'conversation-export',
    messageId: `m-${index}`,
    saved: true,
    feedback: index % 2 ? 'up' : '',
    note: index % 3 ? '' : `Not ${index}`,
    tags: index % 2 ? ['kod'] : ['plan'],
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: `2026-09-10T10:00:${String(index % 60).padStart(2, '0')}Z`
  });
}

const all = Array.from({ length: 120 }, (_, index) => record(index));
const ids = all.map(item => item.id);
const firstExport = policy.canExport(all, ids);
assert.equal(firstExport.length, 100);
assert.equal(firstExport[0].id, 'r-0');
assert.equal(firstExport.at(-1).id, 'r-99');

const sparse = policy.canExport(all, ['r-119', 'r-2', 'r-2', 'unknown']);
assert.deepEqual(sparse.map(item => item.id), ['r-2', 'r-119']);

const state = policy.normalizeState({ selected: ids });
assert.equal(state.selected.length, 100);
assert.deepEqual(state.selected.slice(0, 2), ['r-0', 'r-1']);

const localExportContract = source.match(/const payload = \{[\s\S]*?records:entries\.map\(entry=>\(\{ record:entry\.record, role:entry\.role, content:entry\.text\.slice\(0,12000\) \}\)\) \};/);
assert.ok(localExportContract, 'bounded export payload contract missing');
assert.ok(source.includes("schema:'hafize-message-workspace/v1'"));
assert.ok(source.includes("exportedAt:new Date().toISOString()"));
assert.ok(source.includes("type:'application/json'"));
assert.ok(source.includes("download=`hafize-messages-${new Date().toISOString().slice(0,10)}.json`"));

assert.ok(source.includes('const selected = new Set(runtime.state.selected)'));
assert.ok(source.includes('recordEntries().filter(entry=>selected.has(entry.record.id))'));
assert.ok(source.includes('.slice(0,MAX_EXPORT)'));

const noConversationMutation = !source.includes("localStorage.setItem('hafize.conversations.v1'");
assert.equal(noConversationMutation, true);
assert.equal(source.includes("localStorage.removeItem('hafize.conversations.v1'"), false);

console.log('message workspace export tests passed');
