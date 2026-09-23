import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/prompt-library-smart-insert-history.js', import.meta.url), 'utf8');
const bridge = await readFile(new URL('../public/prompt-library-smart-insert-history-bridge.js', import.meta.url), 'utf8');
assert.match(source, /HISTORY_KEY\s*=\s*['"]hafize\.prompt-library\.smart-insert-history\.v1['"]/);
assert.match(source, /MAX_ENTRIES\s*=\s*40/); assert.match(source, /normalizeEntry\(/); assert.match(source, /normalizeHistory\(/); assert.match(source, /loadHistory\(/); assert.match(source, /saveHistory\(/); assert.match(source,
  /record\(/); assert.match(source, /remove\(/); assert.match(source, /clear\(/);
assert.match(source, /promptId/); assert.match(source, /label/); assert.match(source, /usedAt/); assert.match(source, /reason/); assert.doesNotMatch(source, /values|body\s*:/);
assert.match(bridge, /data-prompt-smart-insert/); assert.match(bridge, /hafize:prompt-library-variable-dialog/); assert.match(bridge, /reason !== 'insert'/); assert.match(bridge, /SmartInsertHistory\.record/); assert.doesNotMatch(bridge,
  /Object\.freeze\([^\n]*open/);
console.log('prompt-library-smart-insert-history: ok');
