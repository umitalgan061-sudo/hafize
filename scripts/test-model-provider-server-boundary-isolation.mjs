import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const boundary = await readFile(new URL('../lib/model-provider-server-boundary.mjs', import.meta.url), 'utf8');

assert.doesNotMatch(boundary, /process\.env|API[_-]?KEY|Authorization|Bearer\s|password|credential/i);
assert.doesNotMatch(boundary, /\bfetch\s*\(|node:child_process|exec\s*\(|spawn\s*\(|shell\s*:/i);
assert.match(boundary, /MODEL_PROVIDER_CANCELLED/);
assert.match(boundary, /MODEL_PROVIDER_FAILED/);
assert.match(boundary, /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/);
assert.match(boundary, /PROVIDERS = new Set\(\['nvidia', 'local'\]\)/);

// Production wiring intentionally remains a separate small step. This guard is
// removed only when server.mjs is changed together with its route regression DoD.
let server = '';
try {
  server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
} catch {
  // Isolated fixture runs may omit server.mjs; source-level boundary assertions still apply.
}
if (server) {
  assert.doesNotMatch(server, /model-provider-server-boundary/);
  assert.match(server, /NVIDIA_API_KEY/);
}

console.log('model provider server boundary isolation tests passed');
