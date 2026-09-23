import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const docs = await readFile(new URL('../docs/PROMPT_LIBRARY_SMART_INSERT_RELEASE.md', import.meta.url), 'utf8');
const qa = await readFile(new URL('../docs/PROMPT_LIBRARY_SMART_INSERT_QA.md', import.meta.url), 'utf8');
const ops = await readFile(new URL('../docs/PROMPT_LIBRARY_SMART_INSERT_OPERATIONS.md', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/prompt-library-enhancements.js', import.meta.url), 'utf8');
assert.match(docs, /Syntax/); assert.match(docs, /PWA/); assert.match(docs, /Rollback/); assert.match(docs, /Otomatik submit/);
assert.match(qa, /Temel akış/); assert.match(qa, /Erişilebilirlik/); assert.match(qa, /Hata senaryoları/); assert.match(qa, /Regression/);
assert.match(ops, /Release öncesi/); assert.match(ops, /Rollback/); assert.match(ops, /Cache/); assert.match(ops, /Veri kurtarma/);
for (const asset of ['smart-insert.js','smart-insert-center.js','smart-insert-history.js','smart-insert-suggestions.js','smart-insert-presets.js','smart-insert-validation.js','smart-insert-activity.js']) assert.match(index,
  new RegExp(asset.replaceAll('.', '\\.'), 'g'));
console.log('prompt-library-smart-insert-release: ok');
