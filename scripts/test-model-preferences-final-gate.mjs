import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertCacheVersionAtLeast } from './shell-cache-contract.mjs';

const root=process.cwd();
const state=fs.readFileSync(path.join(root,'public/typed/model-preferences.ts'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/typed/model-preferences-ui.ts'),'utf8');
const shell=fs.readFileSync(path.join(root,'public/typed/app-shell.ts'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw-policy.js'),'utf8');

assert.match(state,/hafize\.model-preferences\.v1/);
assert.match(state,/maxProfiles: 6/);
assert.match(state,/previewModelPreferenceImport/);
assert.match(state,/renameProfile/);
assert.match(state,/duplicateProfile/);
assert.match(ui,/globalThis\.confirm/);
assert.match(ui,/event\.key === 'Tab'/);
assert.match(ui,/onStorage/);
assert.match(shell,/modelPreferencesController/);
assert.match(shell,/preference\.selectedModel/);
assert.match(shell,/preference\.selectedAgentId/);
assert.match(html,/model-preferences\.css/);
assertCacheVersionAtLeast(45, 'model preferences');
assert.match(sw,/model-preferences\.css/);
assert.doesNotMatch(state+ui,/access_token|refresh_token|client_secret/i);
console.log('model preferences final gate ok');
