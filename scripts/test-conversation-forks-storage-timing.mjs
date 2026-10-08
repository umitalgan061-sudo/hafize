import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
const dialog=s.slice(s.indexOf('function openDialog'),s.indexOf('function comparisonData'));
const creation=s.slice(s.indexOf('function createFork'),s.indexOf('function decorateMessages'));
assert.ok(!dialog.includes('setItem(STORAGE_KEY'));
assert.match(creation,/openDialog\(source, target/);
assert.match(creation,/writeConversations/);
console.log('conversation fork storage timing: ok');
