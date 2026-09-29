import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences-ui.ts'),'utf8');
assert.match(source,/Adlandır/);
assert.match(source,/Çoğalt/);
assert.match(source,/Sil/);
assert.match(source,/Uygula/);
assert.match(source,/renameProfile/);
assert.match(source,/duplicateProfile/);
assert.match(source,/removeProfile/);
console.log('model preferences profile actions ok');
