import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtimeSource = await readFile(new URL('../lib/cloud-session-node-server-runtime.mjs', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../lib/cloud-session-http-api.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(runtimeSource, /new TextDecoder\('utf-8', \{ fatal: true \}\)/, 'login bytes must use fatal UTF-8 decoding');
assert.match(runtimeSource, /CLOUD_SESSION_INVALID_UTF8/);
assert.match(runtimeSource, /CLOUD_SESSION_INVALID_CONTENT_LENGTH/);
assert.match(runtimeSource, /CLOUD_SESSION_LENGTH_MISMATCH/);
assert.match(runtimeSource, /CLOUD_SESSION_UNSUPPORTED_CONTENT_ENCODING/);
assert.match(runtimeSource, /charset\\s\*=\\s\*/, 'charset parsing must be explicit');
assert.match(runtimeSource, /buffer\.subarray\(0, UTF8_BOM\.length\)\.equals\(UTF8_BOM\)/, 'BOM must not create an alternate representation');
assert.doesNotMatch(runtimeSource, /\.toString\(['"]utf8['"]\)/, 'auth request bodies must not use replacement-character UTF-8 decoding');
assert.doesNotMatch(runtimeSource, /startsWith\(['"]application\/json['"]\)/, 'media type must not use prefix matching');
assert.doesNotMatch(runtimeSource, /createGunzip|createBrotliDecompress|inflate|gunzip|brotli/i, 'auth boundary must not transparently decompress request bodies');

assert.match(apiSource, /CLOUD_SESSION_INVALID_UTF8/);
assert.match(apiSource, /CLOUD_SESSION_INVALID_CONTENT_LENGTH/);
assert.match(apiSource, /CLOUD_SESSION_LENGTH_MISMATCH/);
assert.match(apiSource, /CLOUD_SESSION_UNSUPPORTED_CONTENT_ENCODING/);
assert.match(apiSource, /connection: 'close'/, 'ambiguous body framing must close the connection');
assert.doesNotMatch(apiSource, /error\.stack|error\.detail|privateDetail/, 'private decoder details must not be serialized');

assert.equal(registry.agents.length, 4, 'this transport hardening must not expand the agent roster');
assert.equal(registry.agents.filter((agent) => agent.kind === 'selector').length, 2);
assert.equal(registry.agents.filter((agent) => agent.kind === 'specialist').length, 2);
assert.equal(registry.agents.every((agent) => agent.toolPolicy?.default === 'deny'), true, 'tool permission remains backend default-deny');
assert.equal(registry.policy?.externalWritesRequireApproval, true);
assert.equal(registry.policy?.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy?.sharedTraceIdRequired, true);

for (const source of [runtimeSource, apiSource]) {
  assert.doesNotMatch(source, /shell\s*:\s*true|shell=True|child_process|exec\(|spawn\(/, 'cloud auth must not gain terminal execution');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|navigator\.clipboard/, 'cloud auth must not add client persistence');
  assert.doesNotMatch(source, /NVIDIA_API_KEY|GITHUB_TOKEN|GOOGLE_CLIENT_SECRET|CANVA_CLIENT_SECRET/, 'provider credentials must not enter cloud session parser');
}

console.log('cloud session body integrity security contract tests passed');