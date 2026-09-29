import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const shell=fs.readFileSync(path.join(process.cwd(),'public/typed/app-shell.ts'),'utf8');
assert.match(shell,/loadModelPreferences\(\)/);
assert.match(shell,/preference\.selectedModel/);
assert.match(shell,/preference\.selectedAgentId/);
assert.match(shell,/models\.includes\(preference\.selectedModel\)/);
assert.match(shell,/allowedIds\.has\(preference\.selectedAgentId\)/);
console.log('model preferences selection restore ok');
