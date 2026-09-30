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

// Five connector read modules are still `.mjs`, and the two connector runtimes
// import them across that boundary on purpose. Naming the remaining surface
// keeps the gate honest: everything else must be `.ts`-only, and anything that
// leaves this list can never come back.
const PENDING_MJS_DEPENDENCIES = Object.freeze({
  'lib/canva-agent-runtime.ts': [
    './oauth-token-store-runtime.mjs', './canva-read-client.mjs', './canva-read-tool-boundary.mjs'
  ],
  'lib/gmail-agent-runtime.ts': [
    './oauth-token-store-runtime.mjs', './gmail-read-client.mjs', './gmail-read-tool-boundary.mjs'
  ]
});

for (const path of securityFiles) {
  assert.equal(existsSync(join(root, path)), true, `missing typed security source: ${path}`);
  const source = read(path);
  const allowed = PENDING_MJS_DEPENDENCIES[path] ?? [];
  const found = [...source.matchAll(/from '(\.\/[^']+\.mjs)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(found, [...allowed].sort(), `unexpected .mjs imports in ${path}`);
  for (const dependency of allowed) {
    const name = dependency.replace(/^\.\//, '').replace(/\.mjs$/, '');
    assert.equal(existsSync(join(root, 'lib', `${name}.ts`)), false,
      `${name} now has a .ts source, so ${path} must import that instead`);
  }
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

const bridges = [
  'lib/oauth-pkce.mjs',
  'lib/oauth-callback-contract.mjs',
  'lib/oauth-flow-store.mjs',
  'lib/oauth-token-encryption.mjs',
  'lib/personal-memory-encryption.mjs'
];
// The bridge sits inside `lib/`, so its specifier is a sibling: the expected
// string was built from the repo-relative path and carried a stray `lib/`.
for (const path of bridges) {
  const sibling = path.replace(/^lib\//, '').replace(/\.mjs$/, '.ts');
  assert.equal(read(path).trim(), `export * from './${sibling}';`, `bridge ${path} re-exports ./${sibling}`);
}

console.log('TypeScript security entrypoint gate: ok');
