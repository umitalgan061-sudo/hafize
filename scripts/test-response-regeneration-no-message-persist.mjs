import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
const seg=s.slice(s.indexOf('async function regenerateAssistantMessage'),s.indexOf('function restorePreviousAssistantMessage'));
assert.doesNotMatch(seg,/addMessage\('user'/); assert.match(seg,/buildRegenerationMessages/);
console.log('transient instruction is not persisted contract ok');