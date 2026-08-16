import assert from 'node:assert/strict';
import { createSecureWebPreferences, assertSecureWebPreferences } from '../desktop/browser-window-security.mjs';

const preloadPath = process.platform === 'win32' ? 'C:\\hafize\\preload.mjs' : '/opt/hafize/preload.mjs';
const prefs = createSecureWebPreferences({ preloadPath });
assert.equal(assertSecureWebPreferences(prefs), true);
assert.equal(prefs.contextIsolation, true);
assert.equal(prefs.sandbox, true);
assert.equal(prefs.nodeIntegration, false);
assert.equal(prefs.webSecurity, true);
assert.equal(prefs.webviewTag, false);
assert.equal(Object.isFrozen(prefs), true);

for (const [field, value] of [
  ['contextIsolation', false],
  ['sandbox', false],
  ['nodeIntegration', true],
  ['nodeIntegrationInWorker', true],
  ['webSecurity', false],
  ['allowRunningInsecureContent', true],
  ['webviewTag', true]
]) {
  assert.throws(() => assertSecureWebPreferences({ ...prefs, [field]: value }), new RegExp(field));
}
assert.throws(() => createSecureWebPreferences({ preloadPath: 'relative/preload.mjs' }), /preloadPath/);
assert.throws(() => assertSecureWebPreferences({ ...prefs, preload: 'relative/preload.mjs' }), /preload/);
console.log('browser window security tests passed');
