import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [client, css, enhance, keyboard, countdown, index, sw, readme] = await Promise.all([
  read('public/scheduled-tasks.js'),
  read('public/scheduled-tasks.css'),
  read('public/scheduled-tasks-enhancements.js'),
  read('public/scheduled-tasks-keyboard.js'),
  read('public/scheduled-tasks-countdown.js'),
  read('public/index.html'),
  read('public/sw-policy.js'),
  read('README.md')
]);

assert.match(client, /\/api\/schedules/);
assert.match(client, /credentials:\s*'same-origin'/);
assert.match(client, /MAX_TASK = 20_000/);
assert.match(client, /MAX_LIST = 128/);
assert.match(client, /MAX_ATTEMPTS = 5/);
assert.match(client, /statusText/);
assert.match(client, /Date\.parse\(runAt\) <= Date\.now\(\)/);
assert.match(client, /encodeURIComponent\(id\)/);
assert.match(client, /confirm\?\./);
assert.match(client, /AbortController/);
assert.doesNotMatch(client, /innerHTML\s*=/);
assert.doesNotMatch(client, /HAFIZE_SCHEDULE_AUTH_TOKEN/);
assert.doesNotMatch(client, /NVIDIA_API_KEY/);

assert.match(enhance, /Günlük özet/);
assert.match(enhance, /Kod incelemesi/);
assert.match(enhance, /scheduled-tasks-filter/);

assert.match(keyboard, /shiftKey/);
assert.match(keyboard, /'t'/);
assert.match(keyboard, /ScheduledTasksWorkspace/);
assert.match(keyboard, /input,textarea,select/);

assert.match(countdown, /scheduled-task-countdown/);
assert.match(countdown, /Şimdi çalışması bekleniyor/);
assert.match(countdown, /gün/);
assert.match(countdown, /saat/);

assert.match(css, /max-width:650px/);
assert.match(css, /forced-colors:active/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(index, /scheduled-tasks\.css/);
assert.match(index, /scheduled-tasks\.js/);
assert.match(index, /scheduled-tasks-enhancements\.js/);
assert.match(index, /scheduled-tasks-keyboard\.js/);
assert.match(index, /scheduled-tasks-countdown\.js/);
assertVersionedCacheDeclaration(sw);
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/scheduled-tasks\.js/);
assert.match(sw, /\/scheduled-tasks-keyboard\.js/);
assert.match(sw, /\/scheduled-tasks-countdown\.js/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(readme, /Görev|schedule|Zamanlanmış/);

console.log('scheduled task release regression gate: ok');
