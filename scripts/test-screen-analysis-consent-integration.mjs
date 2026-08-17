import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swPolicy = require('../public/sw-policy.js');

const uiPath = fileURLToPath(new URL('../public/screen-analysis-ui.js', import.meta.url));
const clientPath = fileURLToPath(new URL('../public/screen-analysis-client.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/screen-analysis-consent.css', import.meta.url));
const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
const runtimePath = fileURLToPath(new URL('../lib/screen-analysis-runtime.mjs', import.meta.url));
const contractPath = fileURLToPath(new URL('../lib/screen-analysis-contract.mjs', import.meta.url));

for (const path of [uiPath, clientPath, policyPath, serverPath, runtimePath, contractPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax failed`);
}

const [uiSource, clientSource, cssSource, serverSource, runtimeSource] = await Promise.all([
  readFile(uiPath, 'utf8'),
  readFile(clientPath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(serverPath, 'utf8'),
  readFile(runtimePath, 'utf8')
]);

assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v78');
assert.equal(swPolicy.SHELL_ASSETS.includes('/screen-analysis-client.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/screen-analysis-ui.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/screen-analysis-consent.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/screen-analysis-consent.css',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/screen-analysis',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/screen-analysis',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');

assert.equal(serverSource.includes('createScreenAnalysisServerRuntime'), true);
assert.equal(serverSource.includes('complete: nvidiaJsonCompletion'), true, 'screen analysis remains explicitly NVIDIA-backed');
assert.equal(runtimeSource.includes('validateScreenAnalysisRequest(request)'), true);
assert.equal(runtimeSource.includes("{ type: 'image_url'"), true);
assert.equal(runtimeSource.includes("{ type: 'text', text: prompt }"), true);
assert.equal(clientSource.includes("const ENDPOINT = '/api/screen-analysis'"), true);
assert.equal(clientSource.includes("method: 'POST'"), true);
assert.equal(clientSource.includes("cache: 'no-store'"), true);
assert.equal(clientSource.includes('explicitUserIntent !== true'), true);

assert.equal(uiSource.includes("privacy.textContent = 'Sohbet kutusundaki taslak bu işleme dahil edilmez."), true);
assert.equal(uiSource.includes("status.textContent = 'Gönderim özetini kontrol et. Henüz hiçbir şey gönderilmedi.'"), true);
assert.equal(uiSource.includes("reviewNote.textContent = 'Devam edersen seçtiğin görüntü ve yukarıdaki analiz talimatı NVIDIA servisine gönderilir.'"), true);
assert.equal(uiSource.includes("promptInput.maxLength = MAX_PROMPT_CHARS"), true);
assert.equal(uiSource.includes("review.setAttribute('aria-live', 'polite')"), true);
assert.equal(uiSource.includes("review.setAttribute('aria-atomic', 'true')"), true);
assert.equal(uiSource.includes("promptInput.setAttribute('aria-describedby', 'screenAnalysisPrivacy')"), true);
assert.equal(uiSource.includes("controller?.abort?.()"), true);
assert.equal(uiSource.includes('destroy()'), true);

assert.match(cssSource, /min-height:\s*44px/);
assert.match(cssSource, /:focus-visible/);
assert.match(cssSource, /prefers-reduced-motion:\s*reduce/);
assert.match(cssSource, /forced-colors:\s*active/);
assert.match(cssSource, /screen-analysis-review\[hidden\]/);
assert.match(cssSource, /data-stage="confirm"/);

console.log('screen analysis consent integration tests passed');