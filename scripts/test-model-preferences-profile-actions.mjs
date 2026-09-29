import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences.ts'),'utf8');
assert.match(source,/renameProfile/);
assert.match(source,/duplicateProfile/);
assert.match(source,/requestedName/);
assert.match(source,/kopyası/);
assert.match(source,/maxProfiles/);
console.log('model preferences profile lifecycle actions ok');
