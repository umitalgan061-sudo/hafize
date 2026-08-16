import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, styleLoader] = await Promise.all([
  readFile(new URL('../public/canva-connection-status.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/canva-connection-status-style.js', import.meta.url), 'utf8')
]);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /XMLHttpRequest/,
  /\bPOST\b/,
  /\bPUT\b/,
  /\bPATCH\b/,
  /\bDELETE\b/,
  /innerHTML/,
  /outerHTML/,
  /insertAdjacentHTML/,
  /Authorization/,
  /Bearer\s/i,
  /accessToken/i,
  /refreshToken/i,
  /clientSecret/i,
  /ownerId/i,
  /HAFIZE_CONNECTOR_AUTH_TOKEN/,
  /HAFIZE_CONNECTOR_OWNER_KEY_B64/
]) {
  assert.equal(forbidden.test(source), false, `status UI must not expose forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("method: 'GET'"), true);
assert.equal(source.includes("headers: { Accept: 'application/json' }"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes('canvaReadConfigured'), true);
assert.equal(source.includes('linked'), true);
assert.equal(source.includes('Tasarı'), true, 'visible copy should explain design write boundary');
assert.equal(source.includes('paylaşma'), true);
assert.equal(source.includes('silme'), true);

assert.equal(styleLoader.includes('createElement(\'link\')'), true);
assert.equal(styleLoader.includes("link.rel = 'stylesheet'"), true);
assert.equal(styleLoader.includes("link.href = HREF"), true);
for (const forbidden of [/fetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /localStorage/, /sessionStorage/, /document\.cookie/]) {
  assert.equal(forbidden.test(styleLoader), false, `style loader must remain inert: ${forbidden}`);
}

console.log('Canva connection status UI security tests passed');
