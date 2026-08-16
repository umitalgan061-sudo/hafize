import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [loader, policy, source, styleLoader, stylesheet] = await Promise.all([
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/schedule-runtime-status.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/schedule-runtime-status-style.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/schedule-runtime-status.css', import.meta.url), 'utf8')
]);

assert.match(loader, /HafizeScheduleRuntimeStatus/);
assert.match(loader, /HafizeScheduleRuntimeStyle/);
assert.match(loader, /\/schedule-runtime-status\.js/);
assert.match(loader, /\/schedule-runtime-status-style\.js/);
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v55`/);
assert.match(policy, /'\/schedule-runtime-status\.js'/);
assert.match(policy, /'\/schedule-runtime-status-style\.js'/);
assert.match(policy, /'\/schedule-runtime-status\.css'/);
assert.match(policy, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(source, /HEALTH_PATH = '\/api\/health'/);
assert.match(source, /credentials: 'same-origin'/);
assert.match(source, /cache: 'no-store'/);
assert.match(styleLoader, /schedule-runtime-status\.css/);
assert.match(styleLoader, /data-hafize-schedule-runtime-style/);
assert.match(stylesheet, /schedule-runtime-grid/);
assert.match(stylesheet, /prefers-reduced-motion/);
for (const forbidden of [/localStorage/, /sessionStorage/, /document\.cookie/, /navigator\.clipboard/, /WebSocket/, /sendBeacon/, /method:\s*'POST'/, /method:\s*'PUT'/, /method:\s*'DELETE'/]) {
  assert.doesNotMatch(source, forbidden);
}
console.log('schedule runtime status integration tests passed');
