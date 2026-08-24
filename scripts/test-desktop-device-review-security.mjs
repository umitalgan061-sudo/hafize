import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const [ui, shell, preload, main, registryText, sw, css] = await Promise.all([
  source('public/desktop-device-status.js'),
  source('public/ui-shell.js'),
  source('desktop/device-bridge-preload.mjs'),
  source('desktop/device-bridge-main.mjs'),
  source('agents/registry.json'),
  source('public/sw-policy.js'),
  source('public/desktop-device-status.css')
]);

for (const [name, text] of [['device UI', ui], ['UI shell', shell]]) {
  assert.doesNotMatch(text, /\bfetch\s*\(/, `${name} must not add network requests`);
  assert.doesNotMatch(text, /XMLHttpRequest|WebSocket|EventSource|sendBeacon/, `${name} must not add alternate network channels`);
  assert.doesNotMatch(text, /sessionStorage|indexedDB|navigator\.clipboard|document\.cookie/, `${name} must not persist or expose device data`);
  assert.doesNotMatch(text, /innerHTML|outerHTML|insertAdjacentHTML|DOMParser/, `${name} must render untrusted values as text`);
  assert.doesNotMatch(text, /child_process|shell\s*=\s*true|shell:\s*true|exec\s*\(|spawn\s*\(/, `${name} must not expose terminal execution`);
  assert.doesNotMatch(text, /Authorization|Bearer\s|API[_-]?KEY|CLIENT_SECRET|access[_-]?token|refresh[_-]?token/i, `${name} must not read credentials`);
}

assert.match(ui, /reviewText\.textContent\s*=/, 'review target must render as textContent');
assert.match(ui, /confirmPendingAction/, 'device actions require a dedicated confirmation method');
assert.match(ui, /prepareAction\('browser'/, 'browser launcher must enter review first');
assert.match(ui, /prepareAction\('app'/, 'application launcher must enter review first');
assert.doesNotMatch(ui, /addEventListener\('click',\s*\(\)\s*=>\s*bridge\.open/, 'launcher click must not directly call the bridge');
assert.match(ui, /const request = action\.kind === 'browser'[\s\S]*bridge\.openBrowser\(action\.value\)[\s\S]*bridge\.openApp\(action\.value\)/, 'only confirmed normalized actions may reach the bridge');
assert.match(ui, /url\.protocol !== 'https:'/, 'browser target must remain HTTPS-only');
assert.match(ui, /url\.pathname !== '\/'/, 'browser target must remain origin-root only');
assert.match(ui, /\^\[a-z\]\[a-z0-9\._-\]\{1,63\}\$/, 'app IDs must use a narrow allowlist syntax');

assert.match(shell, /hasDesktopDeviceBridge\(root\)/, 'device assets must be conditioned on an exposed bridge');
assert.match(shell, /const DESKTOP_DEVICE_SCRIPT = '\/desktop-device-status\.js'/, 'desktop script path must be fixed same-origin');
assert.match(shell, /const DESKTOP_DEVICE_STYLE = '\/desktop-device-status\.css'/, 'desktop stylesheet path must be fixed same-origin');
assert.doesNotMatch(shell, /hafizeDevice[^\n]{0,80}(localStorage|sessionStorage)/, 'device bridge must not be persisted');

assert.match(preload, /navigator\?\.userActivation\?\.isActive\s*===\s*true/, 'preload must keep a fail-closed user-activation gate for external opens');
assert.match(preload, /createActionId\s*=\s*\(\)\s*=>\s*globalThis\.crypto\?\.randomUUID\?\.\(\)/, 'preload must generate a fresh action ID for external opens');
assert.match(preload, /explicitUserIntent:\s*true,\s*actionId/, 'preload must bind explicit user intent to the generated action ID');
assert.match(preload, /openBrowser/, 'preload must expose the bounded browser method');
assert.match(preload, /openApp/, 'preload must expose the bounded app method');
assert.doesNotMatch(preload, /shell\s*:\s*true|child_process|exec\s*\(|spawn\s*\(/, 'preload must not expose command execution');

assert.match(main, /allowedBrowserOrigins/, 'main process must retain browser-origin allowlisting');
assert.match(main, /appOpeners[\s\S]*allowedApps:\s*handler\.allowedApps/, 'main process must retain the bounded application opener allowlist');
assert.match(main, /shell\.openExternal/, 'browser opening must stay in the bounded Electron main process path');
assert.doesNotMatch(main, /shell\.openPath\s*\([^)]*request|exec\s*\(|spawn\s*\(/, 'main process must not turn requests into general execution');

const registry = JSON.parse(registryText);
assert.equal(registry.agents.length, 4, 'device UI must not grow the agent roster');
assert.equal(registry.agents.filter((agent) => agent.kind === 'selector').length, 2, 'two selectors must remain');
assert.equal(registry.agents.filter((agent) => agent.kind === 'specialist').length, 2, 'two specialists must remain');
assert.ok(registry.agents.every((agent) => !JSON.stringify(agent).includes('openBrowser') && !JSON.stringify(agent).includes('openApp')), 'device bridge must not become an agent tool');

assert.match(sw, /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}v\d+`/, 'device assets must remain behind a versioned shell cache');
assert.match(sw, /'\/desktop-device-status\.js'/, 'desktop device script remains a shell asset');
assert.match(sw, /'\/desktop-device-status\.css'/, 'desktop device stylesheet must be cached');
assert.match(css, /min-height:44px/, 'review and launcher targets must meet the mobile target size');
assert.match(css, /prefers-reduced-motion/, 'device card must respect reduced motion');
assert.match(css, /forced-colors/, 'device card must support forced colors');

console.log('desktop device review security tests passed');
