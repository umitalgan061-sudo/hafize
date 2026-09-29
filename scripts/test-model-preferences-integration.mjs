import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const shell=fs.readFileSync(path.join(root,'public/typed/app-shell.ts'),'utf8');

assert.match(html,/id="modelSelect"/);
assert.match(html,/id="agentSelect"/);
assert.match(html,/id="toolModeBtn"/);
assert.match(html,/model-preferences\.css/);
assert.match(shell,/mountModelPreferences/);
assert.match(shell,/getChoices: \(\) =>/);
assert.match(shell,/toolsEnabled/);
assert.match(shell,/saveConversations\(\)/);
console.log('model preferences integration ok');
