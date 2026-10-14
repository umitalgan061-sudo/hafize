import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const files = ['public/typed/legacy/prompt-library-smart-insert.ts','public/typed/legacy/prompt-library-smart-insert-center.ts','public/typed/legacy/prompt-library-smart-insert-history.ts','public/typed/legacy/prompt-library-smart-insert-history-bridge.ts','public/typed/legacy/prompt-library-smart-insert-suggestions.ts','public/typed/legacy/prompt-library-smart-insert-presets.ts','public/typed/legacy/prompt-library-smart-insert-validation.ts'];
for (const path of files) {
  const source = await readFile(new URL(path, root), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/, `${path} stays local`);
  assert.doesNotMatch(source, /innerHTML\s*=|outerHTML\s*=/, `${path} avoids HTML string injection`);
  assert.doesNotMatch(source, /document\.write\s*\(/, `${path} avoids document.write`);
  assert.match(source, /\btextContent\b|\.value\b/, `${path} uses safe text/value sinks`);
}
const history = await readFile(new URL('public/typed/legacy/prompt-library-smart-insert-history.ts', root), 'utf8');
assert.doesNotMatch(history, /body\s*[:=]|values\s*[:=]/, 'history schema contains no raw prompt values');
const center = await readFile(new URL('public/typed/legacy/prompt-library-smart-insert-center.ts', root), 'utf8');
assert.match(center, /MAX_PROFILES\s*=\s*24/); assert.match(center, /MAX_VALUE\s*=\s*1000/);
const validation = await readFile(new URL('public/typed/legacy/prompt-library-smart-insert-validation.ts', root), 'utf8');
assert.match(validation, /MAX_BODY\s*=\s*8000/); assert.match(validation, /MAX_NAME\s*=\s*32/);
console.log('prompt-library-smart-insert-security: ok');
