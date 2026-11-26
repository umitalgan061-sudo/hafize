/** Stable semantic fingerprints prevent duplicate tool execution in long runs.
 * JSON key ordering and whitespace are irrelevant; array order is not.
 * Never cache a write result or automatically replay a mutation.
 */
function canonicalValue(value: unknown, depth = 0): unknown {
  if (depth > 32) throw new Error('tool arguments too deeply nested');
  if (Array.isArray(value)) return value.map(item => canonicalValue(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    // A null-prototype object preserves even a literal "__proto__" data key.
    const normalized = Object.create(null) as Record<string, unknown>;
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) normalized[key] = canonicalValue(record[key], depth + 1);
    return normalized;
  }
  return value;
}

function canonicalArguments(args: unknown): string {
  const raw = typeof args === 'string' ? args : '{}';
  try { return JSON.stringify(canonicalValue(typeof args === 'string' ? JSON.parse(raw) : args ?? {})); }
  catch { return raw; }
}

const REPO=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA=/^[a-f0-9]{40}$/i;
function record(value:unknown):Record<string,unknown>{
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function repoOf(value:unknown):string{
 return typeof value==='string'&&REPO.test(value)?value.toLowerCase():'';
}
function refreshableRead(name:unknown,args:unknown):string{
 let a:Record<string,unknown>;
 try{a=record(typeof args==='string'?JSON.parse(args):args);}catch{return '';}
 const repo=repoOf(a.repository);
 if(!repo)return '';
 if(name==='github_read_file')return typeof a.ref==='string'&&SHA.test(a.ref)?'':repo;
 if(name!=='github_inspect')return '';
 if(['project','repo','branches','pulls','pull','compare'].includes(String(a.action)))return repo;
 if(['directory','commits'].includes(String(a.action)))return typeof a.ref==='string'&&SHA.test(a.ref)?'':repo;
 return '';
}
export function createToolLoopGuard(maxIdenticalCalls = 1) {
  const seen = new Map<string, number>();
  const epochs=new Map<string,number>();
  const mutationReceipts = new Set<string>();
  const key = (name: unknown, args: unknown): string =>
    `${typeof name === 'string' ? name : ''}\u0000${canonicalArguments(args)}\u0000${epochs.get(refreshableRead(name,args))||0}`;
  return Object.freeze({
    // Only trusted tool results can advance a repository's read epoch.
    // Mutations, immutable file reads and unrelated repos keep their original keys.
    observeGitHubMutation(name:unknown,result:unknown){
      if(name!=='github_develop'&&name!=='github_release')return;
      const outer=record(result),v=record(outer.value),repo=repoOf(v.repository);
      if(outer.ok!==true||!repo||v.existing===true)return;
      const validSha=(x:unknown)=>typeof x==='string'&&SHA.test(x);
      const positive=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0;
      let receipt: unknown[] | undefined;
      if(v.action==='file'&&v.verified===true&&validSha(v.commitSha)&&validSha(v.blobSha)) {
        receipt=['file',v.commitSha];
      } else if(v.action==='branch'&&typeof v.branch==='string'&&v.branch.startsWith('hafize/auto-')&&validSha(v.fromSha)) {
        receipt=['branch',v.branch,v.fromSha];
      } else if((v.action==='pull'||v.action==='open')&&positive(v.number)&&validSha(v.headSha)) {
        receipt=['pull',v.number];
      } else if(v.action==='merge'&&v.merged===true&&positive(v.number)&&validSha(v.mergeCommitSha)) {
        receipt=['merge',v.number,v.mergeCommitSha];
      }
      if(!receipt)return;
      const receiptKey=JSON.stringify([repo,...receipt]);
      // Replayed or aliased receipts must not reopen a consumed read slot.
      if(mutationReceipts.has(receiptKey))return;
      mutationReceipts.add(receiptKey);
      epochs.set(repo,(epochs.get(repo)||0)+1);
    },
    shouldRun(name: unknown, args: unknown): boolean {
      const callKey = key(name, args);
      const count = seen.get(callKey) || 0;
      seen.set(callKey, count + 1);
      return count < maxIdenticalCalls;
    }
  });
}
