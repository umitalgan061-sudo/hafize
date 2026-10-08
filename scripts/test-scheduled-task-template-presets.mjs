import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-template-presets.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-template-presets.css', import.meta.url), 'utf8');

for (const name of ['Günlük haber özeti', 'Haftalık plan', 'Kod incelemesi', 'Araştırma notu', 'Toplantı özeti', 'Kontrol listesi']) {
  assert.ok(js.includes(name), 'missing preset: ' + name);
}
assert.match(js, /ScheduledTaskTemplates/);
assert.match(js, /agentId/);
assert.doesNotMatch(js, /fetch\(/);
assert.match(css, /scheduled-task-template-presets-grid/);
console.log('scheduled-task-template-presets: ok');
