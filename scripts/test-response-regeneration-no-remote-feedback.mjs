import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
const seg=s.slice(s.indexOf('function setAssistantFeedback'),s.indexOf('function setGenerationUi'));
assert.doesNotMatch(seg,/fetch\(/); assert.match(seg,/saveConversations/);
console.log('feedback local-only contract ok');