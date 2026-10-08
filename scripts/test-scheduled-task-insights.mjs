import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-insights.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-insights.css', import.meta.url), 'utf8');

for (const token of ['Toplam', 'Yaklaşan', 'Çalışıyor', 'Başarısız', 'MutationObserver']) assert.ok(js.includes(token));
assert.match(js, /scheduled-task-insights/);
assert.match(js, /dateStyle/);
assert.match(css, /scheduled-task-insights/);
console.log('scheduled-task-insights: ok');
