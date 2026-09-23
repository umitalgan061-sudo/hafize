import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const server = read('server.ts');
const securityFiles = [
  'lib/oauth-pkce.ts',
  'lib/oauth-callback-contract.ts',
  'lib/oauth-flow-store.ts',
  'lib/oauth-token-encryption.ts',
  'lib/personal-memory-encryption.ts',
  'lib/github-read.ts',
  'lib/canva-agent-runtime.ts',
  'lib/gmail-agent-runtime.ts'
];

for (const path of securityFiles) {
  assert.equal(existsSync(join(root, path)), true, `missing typed security source: ${path}`);
  const source = read(path);
  assert.doesNotMatch(source, /(?:\.\/|from ['"])[^'"]+\.mjs['"]/);
}

assert.match(server, /\.\/lib\/github-read\.ts/);
assert.match(server, /\.\/lib\/canva-agent-runtime\.ts/);
assert.match(server, /\.\/lib\/gmail-agent-runtime\.ts/);
assert.match(server, /\.\/lib\/http-runtime\.ts/);
assert.match(server, /\.\/lib\/graceful-shutdown\.ts/);
assert.doesNotMatch(server, /\.\/lib\/[^'"]+\.mjs/);

const packageJson = JSON.parse(read('package.json'));
assert.match(packageJson.scripts.start, /server\.ts$/);
assert.match(packageJson.scripts.typecheck, /tsc/);
assert.match(packageJson.scripts['typecheck:runtime'], /tsconfig\.runtime\.json/);

// Legacy `.mjs` names stay as one-line re-exports so existing importers keep
// working; the re-export target is a sibling, so it is matched on the basename
// rather than the repository path.
const bridges = [
  'lib/oauth-pkce.mjs',
  'lib/oauth-callback-contract.mjs',
  'lib/oauth-flow-store.mjs',
  'lib/oauth-token-encryption.mjs',
  'lib/personal-memory-encryption.mjs',
  'lib/plaintext-credential-policy.mjs',
  'lib/oauth-token-store-runtime.mjs',
  'lib/canva-read-client.mjs',
  'lib/canva-read-tool-boundary.mjs',
  'lib/gmail-read-client.mjs',
  'lib/gmail-read-tool-boundary.mjs'
];
for (const path of bridges) {
  const typedSibling = path.slice(path.lastIndexOf('/') + 1).replace(/\.mjs$/, '.ts');
  assert.equal(read(path).trim(), `export * from './${typedSibling}';`, `${path} is a typed re-export bridge`);
}

console.log('TypeScript security entrypoint gate: ok');
