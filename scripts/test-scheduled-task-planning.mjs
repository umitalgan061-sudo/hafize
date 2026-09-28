import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-planning.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-planning.css', import.meta.url), 'utf8');

for (const token of ['5 dk', '30 dk', '1 saat', 'Yarın 09:00', 'Görevlerde ara', 'run-asc', 'run-desc']) {
  assert.ok(js.includes(token), 'missing planning feature: ' + token);
}
assert.ok(js.includes('toLocaleLowerCase'));
assert.ok(js.includes('Date.parse'));
assert.ok(js.includes('MutationObserver'));
assert.doesNotMatch(js, /root\.fetch/);
assert.doesNotMatch(js, /XMLHttpRequest/);
assert.ok(css.includes('scheduled-task-list-controls'));
console.log('scheduled-task-planning: ok');
