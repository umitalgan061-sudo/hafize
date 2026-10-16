import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertCacheVersionAtLeast } from './shell-cache-contract.mjs';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

const state=read('public/typed/model-preferences.ts');
const ui=read('public/typed/model-preferences-ui.ts');
const shell=read('public/typed/app-shell.ts');
const html=read('public/index.html');
const sw=read('public/sw-policy.ts');
const css=read('public/model-preferences.css');

const stateContracts=[
  /MODEL_PREFERENCES_STORAGE_KEY/,
  /normalizeProfile/,
  /normalizeState/,
  /loadModelPreferences/,
  /saveModelPreferences/,
  /rememberSelection/,
  /createProfile/,
  /upsertProfile/,
  /removeProfile/,
  /renameProfile/,
  /duplicateProfile/,
  /touchProfile/,
  /rankProfiles/,
  /previewModelPreferenceImport/,
  /importModelPreferences/,
  /exportModelPreferences/
];
for(const pattern of stateContracts) assert.match(state,pattern);

const uiContracts=[
  /role', 'dialog'/,
  /aria-labelledby/,
  /aria-controls/,
  /aria-expanded/,
  /event\.key === 'Tab'/,
  /Escape/,
  /document\.addEventListener\('keydown', keyboard\)/,
  /globalThis\.addEventListener\('storage', onStorage\)/,
  /globalThis\.confirm/,
  /options\.apply/
];
for(const pattern of uiContracts) assert.match(ui,pattern);

assert.match(shell,/mountModelPreferences/);
assert.match(shell,/loadModelPreferences/);
assert.match(shell,/preference\.selectedModel/);
assert.match(shell,/preference\.selectedAgentId/);
assert.match(shell,/saveConversations/);

assert.match(html,/model-preferences\.css/);
assert.match(html,/typed-build\/app-shell\.js/);
assertCacheVersionAtLeast(45);
assert.match(sw,/model-preferences\.css/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/forced-colors/);

assert.doesNotMatch(state+ui,/access_token|refresh_token|client_secret/i);
assert.doesNotMatch(state+ui,/navigator\.sendBeacon/);
assert.doesNotMatch(state,/XMLHttpRequest|WebSocket/);

console.log('model preferences smoke ok');
