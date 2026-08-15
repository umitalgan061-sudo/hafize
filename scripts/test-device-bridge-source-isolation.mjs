import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const paths = [
  '../desktop/device-bridge-contract.mjs',
  '../desktop/device-bridge-main.mjs',
  '../desktop/device-bridge-preload.mjs',
  '../desktop/browser-window-security.mjs',
  '../desktop/app-shell.mjs'
];
const [contract, main, preload, browserSecurity, appShell] = await Promise.all(
  paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8'))
);
const source = [contract, main, preload, browserSecurity, appShell].join('\n');

for (const forbidden of [
  "node:child_process",
  'child_process',
  'exec(',
  'execFile(',
  'spawn(',
  'shell.openPath',
  'ipcRenderer.send',
  'nodeIntegration: true',
  'webSecurity: false',
  'allowRunningInsecureContent: true'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden desktop bridge pattern: ${forbidden}`);
}
assert.equal(source.includes("audio: true"), false);
assert.match(source, /DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT/);
assert.match(source, /DEVICE_RENDERER_NOT_TRUSTED/);
assert.match(source, /DEVICE_BROWSER_ORIGIN_NOT_ALLOWED/);
assert.match(source, /contextIsolation: true/);
assert.match(source, /sandbox: true/);

assert.equal(preload.includes('allowedBrowserOrigins'), false,
  'renderer preload must not expose browser allowlist configuration');
assert.equal(preload.includes('allowedOrigins'), false,
  'renderer preload must not expose a generic origin-policy escape hatch');
assert.match(main, /allowedBrowserOrigins = \[\]/,
  'browser allowlist must enter through Electron main registration');
assert.match(main, /allowedBrowserOrigins,/,
  'main process must pass its browser allowlist into the bridge handler');
assert.match(appShell, /allowedBrowserOrigins = \[\]/,
  'app shell must default external browser access to deny-all');
assert.match(appShell, /appOpeners,\s*allowedBrowserOrigins,\s*isTrustedSender:/,
  'app shell must wire the allowlist alongside trusted-sender enforcement');
assert.equal(contract.includes("new Set(['url', 'explicitUserIntent'])"), true,
  'renderer browser.open args must not accept policy fields');

console.log('device bridge source isolation tests passed');
