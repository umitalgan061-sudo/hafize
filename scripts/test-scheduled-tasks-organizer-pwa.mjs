import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');

for (const asset of [
  'scheduled-tasks-organizer.css',
  'scheduled-tasks-actions.css',
  'scheduled-tasks-dashboard.css',
  'scheduled-tasks-organizer.js',
  'scheduled-tasks-actions.js',
  'scheduled-tasks-dashboard.js'
]) assert.match(index, new RegExp(`/${asset.replace('.', '\\.')}`));

for (const asset of [
  '/scheduled-tasks-organizer.css',
  '/scheduled-tasks-actions.css',
  '/scheduled-tasks-dashboard.css',
  '/scheduled-tasks-organizer.js',
  '/scheduled-tasks-actions.js',
  '/scheduled-tasks-dashboard.js'
]) assert.match(sw, new RegExp(`['"]${asset.replace('.', '\\.')}`));

assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v38`/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /return 'network-only'/);
assert.doesNotMatch(sw, /api\/schedules[^\n]*cache/i);
console.log('scheduled-task organizer PWA: ok');
