import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const toolSource = await readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8');
const registrySource = await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8');

assert.match(source, /createPersonalMemoryServerRuntime/);
assert.match(source, /MEMORY_SERVER_RUNTIME = await createPersonalMemoryServerRuntime\(\{ readJson \}\)/);
assert.match(source, /memoryConfigured: MEMORY_SERVER_RUNTIME\.configured/);
assert.match(source, /url\.pathname === '\/api\/memory' \|\| url\.pathname\.startsWith\('\/api\/memory\/'\)/);
assert.match(source, /if \(!MEMORY_SERVER_RUNTIME\.configured\)[\s\S]*?404[\s\S]*?NOT_FOUND/);
assert.match(source, /MEMORY_SERVER_RUNTIME\.handle\(\{[\s\S]*?request: req,[\s\S]*?method: req\.method,[\s\S]*?pathname: url\.pathname,[\s\S]*?url,[\s\S]*?headers: req\.headers/);
assert.doesNotMatch(source, /memoryConfigured:\s*Boolean\([^\n]*(?:KEY|TOKEN|SECRET)/i);

for (const forbidden of ['memory.write', 'memory.delete']) {
  assert.equal(toolSource.includes(forbidden), false, `${forbidden} must not enter model tool runtime`);
  assert.equal(registrySource.includes(forbidden), false, `${forbidden} must not enter agent registry`);
}

console.log('personal memory server wiring tests passed');
