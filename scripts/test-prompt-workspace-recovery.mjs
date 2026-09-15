import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-recovery.js', 'utf8');
assert.match(source, /PROMPT_KEY/);
assert.match(source, /WORKSPACE_KEY/);
assert.match(source, /function snapshot\(/);
assert.match(source, /function resetPreferences\(/);
assert.match(source, /function clearWorkspaceOnly\(/);
assert.match(source, /Prompt kayıtları korunur/);
assert.equal(source.includes('removeItem(PROMPT_KEY)'), false);
assert.equal(source.includes('removeItem(REVISION_KEY)'), false);
assert.equal(/fetch\s*\(/.test(source), false);
console.log('prompt workspace recovery: ok');
