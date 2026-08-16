import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [loader, policy, moduleSource] = await Promise.all([
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/conversation-model-state.js', import.meta.url), 'utf8')
]);
assert.match(loader, /HafizeConversationModelState/);
assert.match(loader, /\/conversation-model-state\.js/);
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v53`/);
assert.match(policy, /'\/conversation-model-state\.js'/);
assert.match(policy, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(moduleSource, /STORAGE_KEY = 'hafize\.conversations\.v1'/);
assert.match(moduleSource, /modelId/);
assert.match(moduleSource, /send\.classList\.contains\('streaming'\)/);
assert.match(moduleSource, /select\.disabled = true/);
for (const forbidden of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /document\.cookie/, /navigator\.clipboard/, /\.requestSubmit\s*\(/, /\.submit\s*\(/]) {
  assert.doesNotMatch(moduleSource, forbidden);
}
console.log('conversation model state integration tests passed');
