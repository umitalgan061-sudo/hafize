import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'public/typed/model-preferences-ui.ts'), 'utf8');
const state = fs.readFileSync(path.join(root, 'public/typed/model-preferences.ts'), 'utf8');

assert.match(source, /accept = 'application\/json,\.json'/);
assert.match(source, /selectedFile\.size > MODEL_PREFERENCES_LIMITS\.maxImport/);
assert.match(source, /JSON\.parse\(text\)/);
assert.match(source, /importModelPreferences/);
// Serialization and the export cap belong to the state module; the UI only
// wraps the string it returns in a Blob.
assert.match(source, /const payload = exportModelPreferences\(state\);/);
assert.match(source, /new Blob\(\[payload\]/);
assert.match(state, /JSON\.stringify\(payload, null, 2\)/);
assert.match(state, /output\.length <= MODEL_PREFERENCES_LIMITS\.maxExport/);
assert.match(state, /hafize-model-preferences/);
assert.match(state, /maxImport: 200_000/);
assert.match(state, /maxExport: 200_000/);
assert.match(state, /while \(ids\.has\(profile\.id\)\)/);
console.log('model preferences import export contract ok');
