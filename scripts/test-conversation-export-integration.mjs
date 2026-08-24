import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const exportSource = fs.readFileSync(new URL('../public/conversation-export.js', import.meta.url), 'utf8');
const loaderSource = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const swSource = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(loaderSource, /HafizeConversationExport/);
assert.match(loaderSource, /\/conversation-export\.js/);
assert.match(loaderSource, /data-hafize-conversation-export/);

assert.match(swSource, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(swSource, /'\/conversation-export\.js'/);
assert.match(swSource, /pathname\.startsWith\('\/api\/'\).*network-only/s);

assert.match(exportSource, /\.conversation-row\.active \.conversation-open/);
assert.match(exportSource, /querySelectorAll\('\.message'\)/);
assert.match(exportSource, /querySelector\?\.\('\.content'\)/);
assert.match(exportSource, /MAX_MESSAGES = 500/);
assert.match(exportSource, /MAX_MESSAGE_CHARS = 256 \* 1024/);
assert.match(exportSource, /MAX_EXPORT_CHARS = 1024 \* 1024/);
assert.match(exportSource, /text\/markdown;charset=utf-8/);
assert.match(exportSource, /text\/plain;charset=utf-8/);
assert.match(exportSource, /createObjectURL/);
assert.match(exportSource, /revokeObjectURL/);
assert.match(exportSource, /anchor\.download/);
assert.match(exportSource, /anchor\.rel = 'noopener'/);

assert.match(exportSource, /aria-haspopup/);
assert.match(exportSource, /aria-modal/);
assert.match(exportSource, /aria-labelledby/);
assert.match(exportSource, /aria-describedby/);
assert.match(exportSource, /event\?\.key === 'Escape'/);
assert.match(exportSource, /event\?\.key !== 'Tab'/);
assert.match(exportSource, /previousFocus\?\.focus/);
assert.match(exportSource, /role', 'status'/);
assert.match(exportSource, /aria-live', 'polite'/);
assert.match(exportSource, /prefers-reduced-motion|transition|backdrop-filter/);

for (const forbidden of [
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'navigator.clipboard',
  'requestSubmit',
  '.submit(',
  'sendBeacon',
  'eval(',
  'new Function',
  'innerHTML'
]) {
  assert.equal(exportSource.includes(forbidden), false, `forbidden API in export controller: ${forbidden}`);
}

const module = { exports: {} };
vm.runInNewContext(exportSource, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;
assert.equal(typeof api.collectTranscript, 'function');
assert.equal(typeof api.buildExport, 'function');
assert.equal(typeof api.createController, 'function');
assert.equal(typeof api.mount, 'function');

const swModule = { exports: {} };
vm.runInNewContext(swSource, {
  module: swModule,
  exports: swModule.exports,
  globalThis: {},
  self: {},
  URL,
  Set,
  Object,
  String
});
const sw = swModule.exports;
assert.match(sw.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.ok(sw.SHELL_ASSETS.includes('/conversation-export.js'));
assert.equal(sw.classifyRequest({
  method: 'GET',
  url: 'https://hafize.test/api/chat',
  headers: { accept: 'application/json' }
}, 'https://hafize.test'), 'network-only');
assert.equal(sw.classifyRequest({
  method: 'GET',
  url: 'https://hafize.test/conversation-export.js',
  headers: { accept: 'text/javascript' }
}, 'https://hafize.test'), 'shell');

console.log('conversation export integration ok');
