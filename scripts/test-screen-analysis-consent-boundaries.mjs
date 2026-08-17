import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateScreenAnalysisRequest, SCREEN_ANALYSIS_LIMITS } from '../lib/screen-analysis-contract.mjs';

const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
const valid = {
  model: 'nvidia/vision-model',
  prompt: 'Bu ekranı analiz et.',
  image: jpeg,
  explicitUserIntent: true
};

assert.equal(SCREEN_ANALYSIS_LIMITS.provider, 'nvidia');
assert.equal(SCREEN_ANALYSIS_LIMITS.maxPromptLength, 4000);
assert.equal(validateScreenAnalysisRequest(valid).ok, true);
assert.deepEqual(validateScreenAnalysisRequest({ ...valid, explicitUserIntent: false }), {
  ok: false,
  error: 'INVALID_SCREEN_ANALYSIS_REQUEST',
  reason: 'explicit_user_intent_required'
});
assert.equal(validateScreenAnalysisRequest({ ...valid, model: 'local:qwen' }).reason, 'nvidia_model_required');
assert.equal(validateScreenAnalysisRequest({ ...valid, model: ' local:qwen ' }).reason, 'nvidia_model_required');
assert.equal(validateScreenAnalysisRequest({ ...valid, model: 'nvidia/model\nother' }).reason, 'invalid_model');
assert.equal(validateScreenAnalysisRequest({ ...valid, prompt: '' }).reason, 'invalid_prompt');
assert.equal(validateScreenAnalysisRequest({ ...valid, prompt: 'x'.repeat(4001) }).reason, 'invalid_prompt');
assert.equal(validateScreenAnalysisRequest({ ...valid, prompt: 'a\0b' }).reason, 'invalid_prompt');
assert.equal(validateScreenAnalysisRequest({ ...valid, surprise: true }).reason, 'invalid_fields');
assert.equal(validateScreenAnalysisRequest({ ...valid, image: 'data:image/png;base64,/9j/2Q==' }).reason, 'invalid_jpeg');

const uiPath = fileURLToPath(new URL('../public/screen-analysis-ui.js', import.meta.url));
const clientPath = fileURLToPath(new URL('../public/screen-analysis-client.js', import.meta.url));
const contractPath = fileURLToPath(new URL('../lib/screen-analysis-contract.mjs', import.meta.url));
const [uiSource, clientSource, contractSource] = await Promise.all([
  readFile(uiPath, 'utf8'),
  readFile(clientPath, 'utf8'),
  readFile(contractPath, 'utf8')
]);

assert.equal(uiSource.includes("querySelector?.('#messageInput')"), false, 'composer draft must never be read by screen analysis UI');
assert.equal(uiSource.includes('messageInput'), false, 'composer draft must not enter screen-analysis code path');
assert.equal(uiSource.includes("promptInput.id = 'screenAnalysisPrompt'"), true);
assert.equal(uiSource.includes("analyzeButton.textContent = 'Onayla ve gönder'"), true);
assert.equal(uiSource.includes("reviewSnapshot = null"), true);
assert.equal(uiSource.includes("event?.key !== 'Escape'"), true);
assert.equal(uiSource.includes("promptInput.addEventListener('input', onPromptInput)"), true);
assert.equal(uiSource.includes("modelSelect.addEventListener('change', onModelChange)"), true);
assert.equal(uiSource.includes("sameSnapshot(reviewSnapshot"), true);
assert.equal(uiSource.includes("explicitUserIntent: true"), true);
assert.equal(clientSource.includes("clean.startsWith('local:')"), true);
assert.equal(contractSource.includes("model.startsWith('local:')"), true);

for (const [name, source] of [['ui', uiSource], ['client', clientSource]]) {
  for (const forbidden of [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /indexedDB/i,
    /document\.cookie/,
    /navigator\.clipboard/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /sendBeacon/,
    /innerHTML/,
    /outerHTML/,
    /child_process/,
    /shell\s*=\s*true/i,
    /\bexec\s*\(/,
    /\bspawn\s*\(/
  ]) {
    assert.equal(forbidden.test(source), false, `${name} contains forbidden surface ${forbidden}`);
  }
}

assert.equal(/Authorization/i.test(uiSource), false);
assert.equal(/Authorization/i.test(clientSource), false);
assert.equal(/NVIDIA_API_KEY|GITHUB_TOKEN|CLIENT_SECRET|REFRESH_TOKEN/i.test(uiSource), false);
assert.equal(/NVIDIA_API_KEY|GITHUB_TOKEN|CLIENT_SECRET|REFRESH_TOKEN/i.test(clientSource), false);

console.log('screen analysis consent boundary tests passed');