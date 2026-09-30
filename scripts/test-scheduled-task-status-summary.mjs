import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertDataAttributeDeclared } from './source-contract.mjs';

const js = await readFile(new URL('../public/scheduled-task-status-summary.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-status-summary.css', import.meta.url), 'utf8');

assert.match(js, /SUMMARY_ID/);
assertDataAttributeDeclared(js, 'data-summary-status');
assert.match(js, /dispatchEvent\(new Event\('change'/);
assert.match(js, /Planlandı/);
assert.match(js, /Çalışıyor/);
assert.match(js, /Başarısız/);
assert.match(css, /scheduled-task-status-summary/);
console.log('scheduled-task-status-summary: ok');
