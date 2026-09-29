import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences.ts'),'utf8');
const required=[
  'normalizeProfile',
  'normalizeState',
  'loadModelPreferences',
  'saveModelPreferences',
  'rememberSelection',
  'createProfile',
  'upsertProfile',
  'removeProfile',
  'renameProfile',
  'duplicateProfile',
  'touchProfile',
  'rankProfiles',
  'previewModelPreferenceImport',
  'importModelPreferences',
  'exportModelPreferences',
  'clearModelPreferences'
];
for(const name of required) {
  assert.match(source,new RegExp('function '+name+'|export function '+name));
}
assert.match(source,/Object\.freeze/);
assert.match(source,/localStorage/);
console.log('model preferences state contract ok');
