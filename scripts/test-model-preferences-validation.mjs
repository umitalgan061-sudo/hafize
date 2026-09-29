import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences.ts'),'utf8');
assert.match(source,/maxProfiles: 6/);
assert.match(source,/maxName: 48/);
assert.match(source,/maxModel: 180/);
assert.match(source,/maxAgentId: 140/);
assert.match(source,/maxImport: 200_000/);
assert.match(source,/Number\.isFinite\(numericUseCount\)/);
assert.match(source,/Math\.min\(9999/);
console.log('model preferences validation ok');
