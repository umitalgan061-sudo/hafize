import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences.ts'),'utf8');
const ui=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences-ui.ts'),'utf8');
assert.match(source,/ModelPreferenceImportPreview/);
assert.match(source,/candidateCount/);
assert.match(source,/validCount/);
assert.match(source,/rejectedCount/);
assert.match(source,/collisionCount/);
assert.match(source,/capacityRemaining/);
assert.match(source,/willImport/);
assert.match(source,/previewModelPreferenceImport/);
assert.match(ui,/previewModelPreferenceImport/);
assert.match(ui,/if \(!preview\.willImport\)/);
assert.match(ui,/globalThis\.confirm\(/);
console.log('model preferences import preview ok');
