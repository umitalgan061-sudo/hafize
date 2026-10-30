import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { errorText, newResults, taskTitle } from '../public/typed/task-notifications.ts';

assert.equal(taskTitle('Rapor hazırla\nikinci satır'), 'Rapor hazırla');
assert.equal(taskTitle(''), 'Arka plan görevi');
assert.equal(taskTitle(null), 'Arka plan görevi');
const long = taskTitle('x'.repeat(200));
assert.equal(long.length, 70);
assert.equal(long.endsWith('…'), true);

assert.equal(errorText('SCHEDULE_MODEL_NOT_CONFIGURED'), 'Model ayarlı olmadığı için görev çalışmadı.');
assert.equal(errorText('secret provider detail'), 'Görev tamamlanamadı.', 'unknown codes must not reach the screen');

const row = (id, readAt = null) => ({ id, task: 't', ok: true, content: '', error: '', createdAt: '', readAt });
assert.deepEqual(newResults([row('c'), row('b'), row('a')], new Set(['b'])).map((item) => item.id), ['a', 'c'], 'oldest first, seen ones skipped');
assert.deepEqual(newResults([row('a', '2026-10-30T00:00:00Z')], new Set()), [], 'read results are not announced again');

const root = new URL('..', import.meta.url);
const index = readFileSync(new URL('public/index.html', root), 'utf8');
const sw = readFileSync(new URL('public/sw-policy.ts', root), 'utf8');
for (const asset of ['/typed-build/task-notifications.js', '/task-notifications.css']) {
  assert.equal(index.includes(asset), true, `index.html loads ${asset}`);
  assert.equal(sw.includes(`"${asset}"`), true, `service worker caches ${asset}`);
}
const guard = readFileSync(new URL('lib/production-guard.ts', root), 'utf8');
assert.equal(guard.includes("'/api/task-results'"), true, 'the panel route receives the signed-in principal');

console.log('task notifications tests passed');
