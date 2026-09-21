import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments-policy.js','utf8');
for(const token of ['MAX_FILES','MAX_BYTES','MAX_TEXT_CHARS','MAX_COMBINED_CHARS','MAX_INSERT_CHARS','MAX_RANGE_LINES','validateFile','binaryScore','formatRangeForComposer']) assert.ok(source.includes(token));
assert.doesNotMatch(source,/fetch\\s*\\(|XMLHttpRequest|WebSocket|sendBeacon/);
assert.match(source,/ALLOWED_EXTENSIONS/);
console.log('composer attachment policy: ok');