import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

assert.match(source, /function collectionUseCount\(workspace, collection\)/);
assert.match(source, /function markUsed\(workspace, id\)/);
assert.match(source, /useCount: Math\.min\(MAX_USE_COUNT, current\.useCount \+ 1\)/);
assert.match(source, /lastUsedAt: now\(\)/);
assert.match(source, /usage-desc/);
assert.match(source, /\$\{meta\.useCount\} kullanım/);
assert.match(source, /stats\(workspace\)/);
assert.match(source, /const uses = collections\.reduce/);
assert.match(source, /Açıldı\./);

const dateUsagePattern = /meta\.lastUsedAt \? .*Intl\.DateTimeFormat/;
assert.match(source, dateUsagePattern);

console.log('prompt collection workspace usage: ok');
