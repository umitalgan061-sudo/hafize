import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  '../desktop/device-bridge-contract.mjs',
  '../desktop/device-bridge-main.mjs',
  '../desktop/device-bridge-preload.mjs',
  '../desktop/browser-window-security.mjs'
];
const source = (await Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))).join('\n');

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
assert.match(source, /contextIsolation: true/);
assert.match(source, /sandbox: true/);
console.log('device bridge source isolation tests passed');
