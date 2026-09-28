import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
const seg=s.slice(s.indexOf('async function regenerateAssistantMessage'),s.indexOf('function restorePreviousAssistantMessage'));
assert.match(seg,/\/api\/chat/); assert.match(seg,/\/api\/agent\/run/); assert.doesNotMatch(seg,/\/api\/regenerate/);
console.log('no extra backend route contract ok');