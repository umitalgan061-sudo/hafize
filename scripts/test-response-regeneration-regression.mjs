import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync('public/typed/app-shell.ts','utf8');
const helper=fs.readFileSync('public/typed/response-variants.ts','utf8');
const css=fs.readFileSync('public/styles.css','utf8');
for(const token of ['regenerateAssistantMessage','restorePreviousAssistantMessage','setAssistantFeedback','navigator.clipboard']) assert.match(app,new RegExp(token));
for(const token of ['normalizeResponseAlternates','rememberResponseAlternate','restoreLatestResponseAlternate','createGenerationSnapshot']) assert.match(helper,new RegExp(token));
assert.match(css,/assistant-message-actions/);
console.log('response regeneration regression contract ok');