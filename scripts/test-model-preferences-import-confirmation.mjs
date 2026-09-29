import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences-ui.ts'),'utf8');
assert.match(source,/selectedFile\.size > MODEL_PREFERENCES_LIMITS\.maxImport/);
assert.match(source,/importModelPreferences/);
assert.match(source,/globalThis\.confirm\(/);
assert.match(source,/Import iptal edildi/);
assert.match(source,/saveModelPreferences\(state\)/);
console.log('model preferences import confirmation ok');
