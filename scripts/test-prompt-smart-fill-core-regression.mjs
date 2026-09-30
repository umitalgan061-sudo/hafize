import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const core = fs.readFileSync(path.join(root,'public/typed/prompt-library.ts'),'utf8');
const smart = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill.ts'),'utf8');
const usage = fs.readFileSync(path.join(root,'public/prompt-library-usage.js'),'utf8');
const starters = fs.readFileSync(path.join(root,'public/prompt-library-starters.js'),'utf8');

for (const token of ['normalizeItem','normalizeCollection','loadItems','saveItems','extractVariables','replaceVariables','mount']) assert.match(core,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(core,/hafize\.prompt-library\.v1/);
assert.match(core,/maxItems: 120/);
assert.match(core,/maxBody: 8000/);
assert.match(core,/maxVariables: 12/);
assert.match(core,/maxVariableValue: 1000/);
assert.match(core,/useCount/);
assert.match(usage,/useCount/);
assert.match(usage,/HafizePromptLibraryUsage/);
assert.match(starters,/HafizePromptLibraryStarters/);
assert.match(starters,/seed/);

assert.match(smart,/extractVariables/);
assert.match(smart,/replaceVariables/);
assert.doesNotMatch(smart,/function normalizeItem/);
assert.doesNotMatch(smart,/function normalizeCollection/);
assert.doesNotMatch(smart,/useCount =/);
assert.match(smart,/composer\.value = text/);
assert.doesNotMatch(smart,/requestSubmit/);
assert.doesNotMatch(smart,/\.submit\(/);

console.log('prompt smart-fill core regression: ok');
