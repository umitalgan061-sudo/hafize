import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/scheduled-tasks-dashboard.js', 'utf8');
const css = fs.readFileSync('public/scheduled-tasks-dashboard.css', 'utf8');

assert.match(source, /function timeMatches\(row, selected\)/);
assert.match(source, /selected === 'past'/);
assert.match(source, /selected === 'next24'/);
assert.match(source, /selected === 'next7'/);
assert.match(source, /new Date\(today\.getFullYear\(\), today\.getMonth\(\), today\.getDate\(\)\)/);
assert.match(source, /data-task-dashboard-time/);
assert.match(source, /applyTimeFilter\(panel\)/);
assert.match(source, /dataset\.dashboardTimeMatch/);
assert.match(css, /data-dashboard-time-match="false"/);
assert.match(source, /TIME_WINDOWS/);
assert.doesNotMatch(source, /Date\.now\(\).*server/i);
console.log('scheduled-task organizer time filters: ok');
