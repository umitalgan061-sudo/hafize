import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../public/app.js', import.meta.url));
const controllerPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const indexPath = fileURLToPath(new URL('../public/index.html', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/chat-run-controller.css', import.meta.url));

const [app, controller, index, policy, css] = await Promise.all([
  readFile(appPath, 'utf8'),
  readFile(controllerPath, 'utf8'),
  readFile(indexPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(cssPath, 'utf8')
]);

for (const file of [appPath, controllerPath]) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${file} syntax failed`);
}

assert.equal(index.includes('id="sendBtn"'), true, 'composer send button must be addressable');
assert.ok(
  index.indexOf('/chat-run-controller.js') < index.indexOf('/app.js'),
  'run controller must load before app bootstrap'
);
assert.equal(index.includes('/chat-run-controller.css'), true);

assert.equal(app.includes('HafizeChatRunController'), true);
assert.equal(app.includes("sendButton: document.querySelector('#sendBtn')"), true);
assert.equal(app.includes("runController.abort('user')"), true);
assert.equal(app.includes("isStreaming ? 'Yanıtı durdur' : 'Gönder'"), true);
assert.equal(app.includes('ui.messageInput.disabled = true'), false,
  'composer text area should remain editable while generation is active');

const chatFetch = app.slice(app.indexOf("fetch('/api/chat'"), app.indexOf('async function runAssistantWithTools'));
assert.equal(chatFetch.includes('signal'), true, 'plain chat fetch must carry the active run signal');
const toolFetch = app.slice(app.indexOf("fetch('/api/agent/run'"), app.indexOf('async function submitMessage'));
assert.equal(toolFetch.includes('signal'), true, 'tool chat fetch must carry the active run signal');

assert.equal(app.includes("content || 'Yanıt durduruldu.'"), true,
  'partial streamed content must be persisted on abort');
assert.equal(app.includes("showToast('Yanıt durduruldu; üretilen bölüm geçmişte korundu.')"), true);
assert.equal(app.includes("`NVIDIA yanıtı alınamadı: ${error?.message || 'bilinmeyen hata'}`"), true);
assert.ok(
  app.indexOf('if (runApi.isAbortError(error, run.signal))') < app.indexOf('NVIDIA yanıtı alınamadı'),
  'user abort must be handled before generic NVIDIA error mapping'
);

for (const forbidden of ['localStorage', 'sessionStorage', 'document.cookie', 'Authorization', 'Bearer ', 'shell=True', 'child_process']) {
  assert.equal(controller.includes(forbidden), false, `run controller must not expose ${forbidden}`);
}
assert.equal(controller.includes('AbortControllerImpl'), true);
assert.equal(controller.includes('token !== active.token'), true,
  'stale generations must not be able to finish a newer run');

assert.match(policy, /hafize-shell-v17/);
for (const asset of ['/chat-run-controller.js', '/chat-run-controller.css']) {
  assert.equal(policy.includes(`'${asset}'`), true, `${asset} must be PWA shell cached`);
}
assert.equal(css.includes('.send-btn.streaming'), true);

console.log('chat stop-generation source tests passed');
