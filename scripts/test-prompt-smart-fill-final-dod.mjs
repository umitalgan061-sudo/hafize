import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = [
  'docs/PROMPT_LIBRARY_SMART_FILL_ARCHITECTURE.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_FAILURE_MODES.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_MIGRATION.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_OPERATIONS.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_PRIVACY.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_QA.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_RELEASE.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_SECURITY.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_TURN_SIGNOFF.md',
  'docs/PROMPT_LIBRARY_SMART_FILL_USER_GUIDE.md'
];
for (const file of docs) assert.ok(fs.statSync(file).size > 0, `${file} missing`);
const required = ['Alanları doldur','Mesaja aktar','Dolu değerleri bu cihazda hatırla','Bu oturumda hatırla'];
const fill = fs.readFileSync('public/prompt-library-fill.js','utf8');
const sessionUi = fs.readFileSync('public/prompt-library-fill-session-ui.js','utf8');
for (const text of required.slice(0,3)) assert.ok(fill.includes(text), `missing ${text}`);
assert.ok(sessionUi.includes(required[3]));
assert.doesNotMatch(fill,/fetch\s*\(/);
assert.doesNotMatch(fill,/innerHTML\s*=/);
console.log('smart fill final DoD: ok');
