import assert from 'node:assert/strict';
import fs from 'node:fs';

const organizer = fs.readFileSync('public/scheduled-tasks-organizer.js', 'utf8');
const actions = fs.readFileSync('public/scheduled-tasks-actions.js', 'utf8');
const dashboard = fs.readFileSync('public/scheduled-tasks-dashboard.js', 'utf8');
const css = fs.readFileSync('public/scheduled-tasks-organizer.css', 'utf8');
const dashboardCss = fs.readFileSync('public/scheduled-tasks-dashboard.css', 'utf8');

assert.match(organizer, /setAttribute\('role', 'group'\)/);
assert.match(organizer, /Görev listesi düzenleme araçları/);
assert.match(organizer, /aria-label', 'Görevlerde ara/);
assert.match(organizer, /aria-label', 'Ajanına göre filtrele/);
assert.match(organizer, /aria-label', 'Görevleri sırala/);
assert.match(actions, /aria-label', 'Görevi seç/);
assert.match(actions, /aria-live/, 'bulk count is announced');
assert.match(dashboard, /role', 'dialog'/);
assert.match(dashboard, /aria-modal/, 'detail dialog is modal');
assert.match(dashboard, /aria-labelledby/);
assert.match(dashboard, /Escape/);
assert.match(css, /:focus-within/);
assert.match(css, /max-width:650px/);
assert.match(dashboardCss, /data-dashboard-time-match="false"/);
assert.match(dashboardCss, /prefers-reduced-motion/);
assert.match(dashboardCss, /forced-colors/);
console.log('scheduled-task organizer UI: ok');
