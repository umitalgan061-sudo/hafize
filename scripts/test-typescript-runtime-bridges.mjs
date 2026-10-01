import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const bridgeTargets = [
  'agent-runtime','agent-delegation','tool-runtime','context-compaction',
  'production-guard','model-response-contract','rate-limit','request-failure',
  'security-observability','server-auth','session-auth','schedule-command-boundary',
  'schedule-execution-runtime','schedule-worker','scheduled-agent-executor',
  'agent-run-ledger','delegated-agent-result-policy','connector-owner-principal',
  'local-model-provider','model-provider-router','model-provider-runtime',
  'plaintext-credential-policy'
];
const read = (path) => readFile(new URL(path, ROOT), 'utf8'));

for (const name of bridgeTargets) {
  const source = (await read('lib/' + name + '.mjs')).trim();
  assert.equal(source, `export * from './${name}.ts';`, 'legacy runtime bridge mismatch: ' + name);
  assert.ok((await read('lib/' + name + '.ts')).trim().length > 0, 'typed runtime missing: ' + name);
}
for (const path of ['lib/agent-delegation.ts','lib/tool-runtime.ts']) {
  const source = await read(path);
  assert.doesNotMatch(source, /from ['"][^'"]+\.mjs['"]/);
  assert.doesNotMatch(source, /@ts-ignore/);
}
const server = await read('server.ts');
assert.doesNotMatch(server, /from ['"][^'"]+\.mjs['"]/);
assert.match(server, /\.\/lib\/tool-runtime\.ts/);
assert.match(server, /signal: controller\.signal/);
console.log('TypeScript runtime bridges: ' + bridgeTargets.length + ' checked');
