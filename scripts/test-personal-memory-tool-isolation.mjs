import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const toolRuntime = await readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8');
const registry = await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

for (const forbidden of [
  'memory_write',
  'memory_delete',
  'personal_memory_write',
  'personal_memory_delete'
]) {
  assert.equal(toolRuntime.includes(forbidden), false, `${forbidden} must not be a model tool`);
}

for (const permission of ['memory.write', 'memory.delete']) {
  assert.equal(registry.includes(`"${permission}"`), false, `${permission} must not be granted to an agent`);
}

for (const secretName of [
  'HAFIZE_MEMORY_KEY_B64',
  'HAFIZE_CONNECTOR_OWNER_KEY_B64',
  'HAFIZE_CONNECTOR_AUTH_TOKEN'
]) {
  assert.equal(app.includes(secretName), false, `${secretName} leaked into public/app.js`);
  assert.equal(index.includes(secretName), false, `${secretName} leaked into public/index.html`);
}

assert.match(toolRuntime, /default_deny|authorizeAgentTool/);
console.log('personal memory tool isolation tests passed');
