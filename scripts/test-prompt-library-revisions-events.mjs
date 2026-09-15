import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /function dispatchRefresh/);
assert.match(s, /new root\.StorageEvent\('storage'/);
assert.match(s, /hafize-prompt-library-refresh/);
assert.match(s, /api\.STORAGE_KEY/);
console.log('revision refresh events: ok');
