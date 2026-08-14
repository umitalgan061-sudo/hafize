import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const share = await readFile(new URL('../public/screen-share.js', import.meta.url), 'utf8');
const client = await readFile(new URL('../public/screen-analysis-client.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../public/screen-analysis-ui.js', import.meta.url), 'utf8');

assert.match(server, /createScreenAnalysisServerRuntime/);
assert.match(server, /configured: Boolean\(NVIDIA_API_KEY\)/);
assert.match(server, /screenAnalysisConfigured: SCREEN_ANALYSIS_SERVER_RUNTIME\.configured/);
assert.match(server, /url\.pathname === '\/api\/screen-analysis'/);
assert.match(server, /res\.on\('close', \(\) => controller\.abort\(\)\)/);
assert.match(server, /signal: controller\.signal/);
assert.match(server, /const MAX_BODY_BYTES = 256 \* 1024/);
assert.doesNotMatch(server, /SCREEN_ANALYSIS_MAX_BODY_BYTES[\s\S]*MAX_BODY_BYTES\s*=/);

assert.match(index, /id="screenShareAnalyze"/);
assert.match(index, /id="screenAnalysisResult"/);
const clientScript = index.indexOf('/screen-analysis-client.js');
const shareScript = index.indexOf('/screen-share.js');
const uiScript = index.indexOf('/screen-analysis-ui.js');
assert.equal(clientScript >= 0 && clientScript < shareScript && shareScript < uiScript, true);

assert.match(share, /hafize:screen-capture-ready/);
assert.match(share, /hafize:screen-capture-cleared/);
assert.match(client, /explicitUserIntent: true/);
assert.match(client, /signal,/);
assert.match(ui, /explicitUserIntent: true/);
assert.match(ui, /Hafize ekran görüntüsünü analiz ediyor/);
assert.doesNotMatch(ui, /localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(client, /ownerId|Authorization|token/);
console.log('screen analysis production wiring tests passed');
