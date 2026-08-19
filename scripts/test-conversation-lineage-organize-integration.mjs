import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const lineage = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const organize = await readFile(new URL('../public/conversation-organize.js', import.meta.url), 'utf8');

assert.match(organize, /row\.dataset\.conversationOrganizeId = id/);
assert.match(organize, /fragment\.append\(row\)/);
assert.match(lineage, /dataset\?\.conversationOrganizeId/);
assert.match(lineage, /validIds\.has\(organizedId\)/);
assert.match(lineage, /claimedIds\.has\(organizedId\)/);
assert.match(lineage, /remainingIds/);
assert.match(lineage, /attributeFilter: \['class', 'data-conversation-organize-id'\]/);

assert.doesNotMatch(lineage, /rows\.forEach\(\(row, index\) => \{\s*const id = normalizeId\(list\[index\]\?\.id\)/s);
assert.doesNotMatch(lineage, /row\.dataset\.conversationId = normalizeId\(list\[index\]/);

const forbidden = [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /document\.cookie/,
  /Authorization/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
];
for (const pattern of forbidden) assert.doesNotMatch(lineage, pattern);

console.log('conversation lineage organize integration tests passed');
