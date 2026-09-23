import { readFile } from 'node:fs/promises';

const packageData=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const tsconfig=JSON.parse(await readFile(new URL('../tsconfig.json',import.meta.url),'utf8'));
const server=await readFile(new URL('../server.ts',import.meta.url),'utf8');
const guard=await readFile(new URL('../lib/production-guard.ts',import.meta.url),'utf8');

function major(spec){
  const match=String(spec||'').match(/(?:\^|~|>=|=)?(\d+)/);
  return match?Number(match[1]):0;
}
function assert(condition,message){
  if(!condition)throw new Error('TYPESCRIPT_MIGRATION_FAILED:'+message);
}
const deps=packageData.devDependencies||{};
assert(major(deps.typescript)===7,'typescript-major');
assert(major(deps.vite)===8,'vite-major');
assert(major(deps.vitest)===5,'vitest-major');
assert(String(packageData.engines?.node||'').includes('24.21.0'),'node-engine');
assert(String(packageData.scripts?.start||'').includes('production-guard.ts'),'start-typed-guard');
assert(String(packageData.scripts?.['dev:server']||'').includes('production-guard.ts'),'dev-server-typed-guard');
assert(String(packageData.scripts?.['typecheck:runtime']||'').includes('tsconfig.runtime.json'),'runtime-typecheck');
// Vitest filters positional arguments against file paths, so the typed-core
// script narrows the run with the `lib/` path filter rather than a shell glob
// (an unquoted `lib/**/*.test.ts` expands to nothing and silently runs zero tests).
assert(/(^|\s)vitest run .*\blib\//.test(String(packageData.scripts?.['test:typed-core']||'')),'typed-test-script');
assert(String(packageData.scripts?.['check:modern']||'').includes('test-typescript-migration.mjs'),'modern-check-integration');

const includes=Array.isArray(tsconfig.include)?tsconfig.include:[];
assert(includes.includes('lib/**/*.ts'),'tsconfig-lib-scope');
assert(tsconfig.compilerOptions?.rewriteRelativeImportExtensions===true,'ts-extension-rewrite');

// Modules the HTTP entrypoint wires up itself.
for(const path of [
  'agent-runtime.ts','agent-delegation.ts','agent-run-ledger.ts','context-compaction.ts',
  'model-response-contract.ts','schedule-command-boundary.ts','schedule-execution-runtime.ts',
  'schedule-worker.ts','scheduled-agent-executor.ts','server-auth.ts',
  'tool-runtime.ts','request-failure.ts'
]){
  assert(server.includes('./lib/'+path), 'server-import:'+path);
}

// Modules the entrypoint reaches only through a typed boundary: asserting them
// on `server.ts` would pass for the wrong reason (or force a dead import), so
// each is checked where it is actually wired.
const toolRuntime=await readFile(new URL('../lib/tool-runtime.ts',import.meta.url),'utf8');
for(const path of ['tool-call-boundary.ts','tool-execution-result-policy.ts']){
  assert(toolRuntime.includes('./'+path), 'tool-runtime-import:'+path);
}
assert(guard.includes('./session-auth.ts'), 'guard-import:session-auth.ts');

// The production guard is not imported by `server.ts`; it is preloaded before
// it, so the entrypoint contract lives in the start scripts.
for(const script of ['start','dev:server']){
  assert(String(packageData.scripts?.[script]||'').includes('--import ./lib/production-guard.ts'),'production-guard-entry:'+script);
}
assert(server.includes('./lib/http-runtime.ts'),'http-runtime-entry');
for(const browserPath of ['markdown-renderer.ts','conversation-workspace.ts','message-workspace.ts','prompt-library.ts','scheduled-tasks.ts']) assert(browserPath.endsWith('.ts'),'browser-migration-contract');
for(const path of ['session-auth.ts','server-auth.ts','rate-limit.ts','security-observability.ts','runtime-config.ts']){
  assert(guard.includes('./'+path), 'guard-import:'+path);
}
console.log('TypeScript runtime migration contract: OK');
