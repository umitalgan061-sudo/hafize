import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
const seg=s.slice(s.indexOf('function restorePreviousAssistantMessage'),s.indexOf('async function submitMessage'));
assert.match(seg,/isStreaming/); assert.match(seg,/restoreLatestResponseAlternate/); assert.match(seg,/saveConversations/);
console.log('restore safety contract ok');