import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const nodeConfig = JSON.parse(readFileSync(new URL('../tsconfig.node.json', import.meta.url), 'utf8'));
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

assert.equal(pkg.scripts.start.includes('server.ts'), true, 'production must start from TypeScript');
assert.equal(pkg.scripts['dev:server'].includes('server.ts'), true, 'dev server must use TypeScript');
assert.equal(pkg.scripts.typecheck.includes('tsconfig.node.json'), true, 'Node TypeScript config must be checked');
assert.equal(nodeConfig.compilerOptions.module, 'NodeNext');
assert.equal(nodeConfig.compilerOptions.moduleResolution, 'NodeNext');
assert.equal(nodeConfig.compilerOptions.erasableSyntaxOnly, true);
assert.ok(existsSync(new URL('../server-runtime.mjs', root)), 'runtime engine must remain available behind the bootstrap');
assert.match(server, /readRuntimeConfig/);
assert.match(server, /validateRuntimeConfig/);
assert.match(server, /await import\('\.\/server-runtime\.mjs'\)/);
for (const path of ['lib/model-response-contract.ts', 'lib/request-failure.ts', 'lib/server-auth.ts']) {
  assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} must exist`);
}
console.log('TypeScript boundary contract: ok');
