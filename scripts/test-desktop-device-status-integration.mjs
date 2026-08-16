import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [loader, policy, source, contract, preload] = await Promise.all([
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/desktop-device-status.js', import.meta.url), 'utf8'),
  readFile(new URL('../desktop/device-bridge-contract.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../desktop/device-bridge-preload.mjs', import.meta.url), 'utf8')
]);

assert.match(loader, /HafizeDesktopDeviceStatus/);
assert.match(loader, /\/desktop-device-status\.js/);
assert.match(loader, /data-hafize-desktop-device-status/);
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v57`/);
assert.match(policy, /'\/desktop-device-status\.js'/);
assert.match(policy, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(contract, /capabilities\.read/);
assert.match(contract, /DEVICE_BROWSER_ORIGIN_NOT_ALLOWED/);
assert.match(contract, /DEVICE_APP_NOT_ALLOWED/);
assert.match(preload, /navigator\?\.userActivation\?\.isActive/);
assert.match(preload, /DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE/);
assert.match(preload, /getCapabilities/);

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /localStorage/,
  /sessionStorage/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /requestSubmit/,
  /\.submit\s*\(/,
  /ipcRenderer/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.doesNotMatch(source, forbidden);
}

assert.match(source, /bridge\.getSystemInfo\(\)/);
assert.match(source, /bridge\.getCapabilities\(\)/);
assert.match(source, /bridge\.openBrowser\(value\)/);
assert.match(source, /bridge\.openApp\(value\)/);
assert.match(source, /görünür düğme tıklaması/);
assert.match(source, /aria-busy/);
assert.match(source, /prefers-reduced-motion/);
assert.match(source, /forced-colors/);

console.log('desktop device status integration tests passed');
