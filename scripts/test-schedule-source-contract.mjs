import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = Object.freeze({
  store: await readFile(new URL('../lib/task-schedule-store.mjs', import.meta.url), 'utf8'),
  commands: await readFile(new URL('../lib/schedule-command-boundary.mjs', import.meta.url), 'utf8'),
  http: await readFile(new URL('../lib/schedule-http-api.mjs', import.meta.url), 'utf8'),
  worker: await readFile(new URL('../lib/schedule-worker.mjs', import.meta.url), 'utf8'),
  ui: await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8'),
  stats: await readFile(new URL('../public/scheduled-tasks-stats.js', import.meta.url), 'utf8')
});

assert.match(files.store, /DEFAULT_MAX_ENTRIES = Number\.POSITIVE_INFINITY/);
assert.match(files.store, /BigInt/);
assert.match(files.store, /nextCursor/);
assert.match(files.store, /cancelMany/);
assert.match(files.store, /MAX_LIST_LIMIT/);
assert.match(files.store, /stats\(ownerId/);
assert.doesNotMatch(files.store, /Math\.min\(.*1024/);
assert.match(files.commands, /ownerId/);
assert.match(files.commands, /cancelMany/);
assert.match(files.commands, /stats/);
assert.doesNotMatch(files.commands, /store\.snapshot\(\)\.entries\.filter/);
assert.match(files.http, /\/api\/schedules\/stats/);
assert.match(files.http, /URLSearchParams|searchParams/);
assert.match(files.http, /bulk-cancel/);
assert.match(files.worker, /Promise\.allSettled/);
assert.match(files.worker, /maxConcurrent/);
assert.match(files.ui, /Daha fazla yükle/);
assert.match(files.ui, /bulk-cancel/);
assert.match(files.ui, /scheduled-tasks-search/);
assert.match(files.stats, /Kullanım|Toplam/);
assert.match(files.stats, /\/api\/schedules\/stats/);
assert.doesNotMatch(files.ui, /MAX_LIST\s*=\s*128/);

console.log('schedule source contract tests passed');
