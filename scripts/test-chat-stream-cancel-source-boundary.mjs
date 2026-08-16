import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../public/app.js', import.meta.url));
const app = await readFile(appPath, 'utf8');

const syntax = spawnSync(process.execPath, ['--check', appPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'public/app.js syntax check failed');

assert.equal(app.includes("sendButton: document.querySelector('.send-btn')"), true,
  'composer must own the visible send/stop control');
assert.equal(app.includes("ui.sendButton.textContent = isStreaming ? '■' : '↑'"), true,
  'streaming must expose a visible stop affordance');
assert.equal(app.includes("ui.sendButton.setAttribute('aria-label', isStreaming ? 'Yanıtı durdur' : 'Gönder')"), true,
  'stop affordance must have an accessible label');
assert.equal(app.includes("ui.composer.setAttribute('aria-busy', String(isStreaming))"), true,
  'composer must expose streaming state to assistive technology');

assert.equal((app.match(/new AbortController\(\)/g) || []).length, 1,
  'each submit path must create one owner AbortController');
assert.equal((app.match(/signal: run\.controller\.signal/g) || []).length, 2,
  'both plain chat and tool-agent fetches must receive the same run signal');
assert.equal(app.includes('activeRun.controller.abort();'), true,
  'stop action must abort the active provider request');
assert.equal(app.includes("showToast('Yanıt durduruluyor…')"), true,
  'stop action must give immediate visible feedback');

assert.equal(app.includes('async function consumeAssistantStream(response, assistantId, emptyMessage, signal)'), true,
  'stream consumer must know whether cancellation was user initiated');
assert.equal(app.includes("if (signal?.aborted || error?.name === 'AbortError')"), true,
  'reader aborts must be classified separately from provider failures');
assert.equal(app.includes("updateMessage(assistantId, content || STOPPED_MESSAGE, { persist: true })"), true,
  'partial or empty streamed output must be persisted on reader cancellation');
assert.equal(app.includes("if (error?.name !== 'AbortError')"), true,
  'user cancellation must not be rendered as an NVIDIA failure');
assert.equal(app.includes("const STOPPED_MESSAGE = 'Yanıt kullanıcı tarafından durduruldu.'"), true,
  'empty cancellations must have a deterministic user-visible result');

const submitHandler = app.slice(
  app.indexOf("ui.composer.addEventListener('submit'"),
  app.indexOf("document.querySelectorAll('[data-prompt]')")
);
assert.equal(submitHandler.includes('if (isStreaming)'), true);
assert.equal(submitHandler.includes('stopActiveRun();'), true,
  'pressing the composer action while streaming must stop rather than submit another request');
assert.equal(submitHandler.includes('submitMessage(ui.messageInput.value);'), true,
  'the same control must return to normal submit behavior when idle');

for (const forbidden of [
  'localStorage.setItem("api',
  "localStorage.setItem('api",
  'sessionStorage.setItem("api',
  "sessionStorage.setItem('api",
  'Authorization: `Bearer ${NVIDIA_API_KEY}`',
  'repo.merge',
  'external.send'
]) {
  assert.equal(app.includes(forbidden), false, `chat cancellation must not add privileged surface: ${forbidden}`);
}

console.log('chat stream cancellation source-boundary tests passed');
