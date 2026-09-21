import { access, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=await readFile(resolve(root,'server.mjs'),'utf8');
const packageData=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));

const migrated=[
  'agent-runtime.ts','agent-delegation.ts','agent-run-ledger.ts',
  'context-compaction.ts','model-response-contract.ts',
  'schedule-command-boundary.ts','schedule-execution-runtime.ts',
  'schedule-lease-executor.ts','schedule-worker.ts','scheduled-agent-executor.ts',
  'server-auth.ts','session-auth.ts','tool-runtime.ts',
  'tool-call-boundary.ts','tool-execution-result-policy.ts',
  'request-failure.ts','runtime-config.ts','security-observability.ts'
];

async function exists(path){try{await access(path);return true;}catch{return false;}}
function assert(value,message){if(!value)throw new Error('TYPESCRIPT_MIGRATION_DEPTH_FAILED:'+message);}

for(const file of migrated){
  assert(await exists(resolve(root,'lib',file)),'missing:'+file);
  const legacy=file.replace(/\.ts$/,'.mjs');
  if(server.includes("./lib/"+legacy))throw new Error('TYPESCRIPT_MIGRATION_DEPTH_FAILED:legacy-import:'+legacy);
}

assert(packageData.scripts?.['typecheck:runtime'],'missing-runtime-typecheck');
assert(packageData.scripts?.['test:typed-core'],'missing-typed-test-script');
assert(String(packageData.scripts?.['check:modern']||'').includes('test-typescript-migration.ts'),'modern-check-not-wired');

const config=await readFile(resolve(root,'tsconfig.runtime.json'),'utf8');
assert(config.includes('"lib/**/*.ts"'),'runtime-config-scope');

console.log('TypeScript migration depth contract: OK');
