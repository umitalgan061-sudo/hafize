import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/scheduled-tasks-organizer.js', 'utf8');

assert.match(source, /STORAGE_KEY = 'hafize\.scheduled-tasks\.view\.v1'/);
assert.match(source, /function readView\(\)/);
assert.match(source, /function saveView\(view\)/);
assert.match(source, /JSON\.parse\(storage\(\)\?\.getItem\(STORAGE_KEY\)/);
assert.match(source, /catch \{/);
assert.match(source, /MAX_QUERY = 120/);
assert.match(source, /MAX_AGENT = 80/);
assert.match(source, /DEFAULT_VIEW/);
assert.match(source, /sort: SORTS\.has/);
assert.match(source, /agent: source\.agent === 'all'/);
assert.match(source, /query: clamp\(source\.query, MAX_QUERY\)/);
assert.doesNotMatch(source, /localStorage.*task/i);
assert.doesNotMatch(source, /localStorage.*credential/i);
assert.doesNotMatch(source, /localStorage.*token/i);
assert.doesNotMatch(source, /sessionStorage/);
console.log('scheduled-task organizer storage: ok');
