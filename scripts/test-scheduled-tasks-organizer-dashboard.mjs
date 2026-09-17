import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/scheduled-tasks-dashboard.js', 'utf8');

assert.match(source, /TIME_WINDOWS/);
assert.match(source, /'all', 'today'/);
assert.match(source, /'next24'/);
assert.match(source, /'next7'/);
assert.match(source, /'past'/);
assert.match(source, /MAX_VIEWS = 6/);
assert.match(source, /hafize\.scheduled-tasks\.views\.v1/);
assert.match(source, /function readViews\(\)/);
assert.match(source, /function writeViews\(views\)/);
assert.match(source, /function currentView\(panel\)/);
assert.match(source, /function applyView\(panel, view\)/);
assert.match(source, /Görünümü kaydet/);
assert.match(source, /Görünümü sil/);
assert.match(source, /savedAt/);
assert.match(source, /same = entries\.find/);
assert.match(source, /slice\(0, MAX_VIEWS\)/);
assert.match(source, /scheduled-task-detail/);
assert.match(source, /JSON olarak kopyala/);
assert.match(source, /Escape/);
assert.doesNotMatch(source, /schedule.*localStorage.*task/i);
console.log('scheduled-task dashboard: ok');
