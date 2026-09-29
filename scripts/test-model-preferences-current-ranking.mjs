import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences.ts'),'utf8');
assert.match(source,/a\.model === current\.model/);
assert.match(source,/a\.agentId === current\.agentId/);
assert.match(source,/a\.useCount/);
assert.match(source,/updatedAt\.localeCompare/);
console.log('model preferences ranking contract ok');
