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
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v56`/);
assert.match(policy, /'\/desktop-device-status\.js'/);
assert.match(policy, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(contract, /system\.info/);
assert.match(preload, /getSystemInfo/);

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
  /openBrowser\s*\(/,
  /openApp\s*\(/,
  /ipcRenderer/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.doesNotMatch(source, forbidden);
}

assert.match(source, /bridge\.getSystemInfo\(\)/);
assert.match(source, /salt-okunur/);
assert.match(source, /aria-busy/);
assert.match(source, /prefers-reduced-motion/);
assert.match(source, /forced-colors/);

console.log('desktop device status integration tests passed');
