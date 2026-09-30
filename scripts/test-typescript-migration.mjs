import { existsSync } from 'node:fs';
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
assert(String(packageData.scripts?.['test:typed-core']||'').includes('lib/**/*.test.ts'),'typed-test-script');
assert(String(packageData.scripts?.['check:modern']||'').includes('test-typescript-migration.mjs'),'modern-check-integration');

const includes=Array.isArray(tsconfig.include)?tsconfig.include:[];
assert(includes.includes('lib/**/*.ts'),'tsconfig-lib-scope');
assert(tsconfig.compilerOptions?.rewriteRelativeImportExtensions===true,'ts-extension-rewrite');

for(const path of [
  'agent-runtime.ts','agent-delegation.ts','agent-run-ledger.ts','context-compaction.ts',
  'model-response-contract.ts','schedule-command-boundary.ts','schedule-execution-runtime.ts',
  'schedule-worker.ts','scheduled-agent-executor.ts','server-auth.ts',
  'tool-runtime.ts','request-failure.ts'
]){
  assert(server.includes('./lib/'+path), 'server-import:'+path);
}
// Three migrated modules are reached through another one rather than imported
// by `server.ts` directly, so each is asserted against its real consumer:
// `session-auth.ts` through the production guard (the loop below), and the two
// tool boundaries through `tool-runtime.ts`.
const toolRuntime=await readFile(new URL('../lib/tool-runtime.ts',import.meta.url),'utf8');
for(const path of ['tool-call-boundary.ts','tool-execution-result-policy.ts']){
  assert(toolRuntime.includes('./'+path), 'tool-runtime-import:'+path);
}

// The guard is a `--import` preload (asserted against the npm scripts above),
// not a server import: it has to run before the server's module graph is
// evaluated, which an import inside `server.ts` cannot guarantee.
assert(!server.includes('./lib/production-guard.ts'),'production-guard-must-stay-a-preload');
assert(String(packageData.scripts?.start||'').includes('--import ./lib/production-guard.ts'),'production-guard-preload');
assert(server.includes('./lib/http-runtime.ts'),'http-runtime-entry');
// The browser modules are asserted through the Vite entry map, which is the
// only place that knows whether an entry lives in `public/` or `public/typed/`.
// The previous form checked that a literal string ends in `.ts`, which is
// always true and therefore asserted nothing.
const viteConfig=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');
const entryBlock=/entry:\s*\{([\s\S]*?)\n\s*\},/.exec(viteConfig)?.[1]||'';
const entrySources=new Map([...entryBlock.matchAll(/'([^']+)':\s*resolve\(ROOT,\s*'([^']+)'\)/g)].map((match)=>[match[1],match[2]]));
for(const entry of ['markdown-renderer','conversation-workspace','message-workspace','prompt-library','scheduled-tasks']){
  const source=entrySources.get(entry);
  assert(Boolean(source),'browser-entry-missing:'+entry);
  assert(source.endsWith('.ts'),'browser-entry-not-typescript:'+entry);
  assert(existsSync(new URL('../'+source,import.meta.url)),'browser-entry-source-missing:'+source);
}
for(const path of ['session-auth.ts','server-auth.ts','rate-limit.ts','security-observability.ts','runtime-config.ts']){
  assert(guard.includes('./'+path), 'guard-import:'+path);
}
console.log('TypeScript runtime migration contract: OK');
