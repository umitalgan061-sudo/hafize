import {it,expect,vi} from 'vitest';
import {reconcilePendingGitHubMutations} from './github-mutation-reconciliation.ts';
import type {Pending} from './agent-turn-checkpoints.ts';
const repo='owner/repo',branch='hafize/auto-test',sha='a'.repeat(40),blob='b'.repeat(40);
const file:Pending={tool:'github_develop',operation:'file',repository:repo,branch,path:'src/app.py',sha,number:null,expectedBlob:blob};
it('settles only exact desired blob at the immutable branch head with GETs, not a new commit',async()=>{
 const fetchImpl=vi.fn(async(u:RequestInfo|URL)=>{const url=new URL(String(u));return Response.json(url.pathname.includes('/git/ref/')?{ref:'refs/heads/'+branch,object:{type:'commit',sha}}:{type:'file',path:file.path,sha:blob,content:'never expose'});});
 const result=await reconcilePendingGitHubMutations({pending:[file],allowedRepositories:[repo],fetchImpl});
 expect(result.settled).toEqual([file]);expect(result.receipts[0]?.kind).toBe('read');expect(JSON.stringify(result.receipts)).not.toContain('never expose');expect(result.receipts[0]?.line).toContain('yeni commit oluşturulmadı');
 expect(fetchImpl).toHaveBeenCalledTimes(2);expect(String(fetchImpl.mock.calls[1]![0])).toContain('?ref='+sha);
});
it('retains mismatches, legacy unknown hashes, blocked paths and unallowlisted repositories',async()=>{
 const fetchImpl=vi.fn(async(u:RequestInfo|URL)=>Response.json(String(u).includes('/git/ref/')?{ref:'refs/heads/'+branch,object:{type:'commit',sha}}:{type:'file',path:file.path,sha}));
 const result=await reconcilePendingGitHubMutations({pending:[file,{...file,expectedBlob:undefined},{...file,path:'.env.json'},{...file,repository:'other/repo'}],allowedRepositories:[repo],fetchImpl});
 expect(result.settled).toEqual([]);expect(fetchImpl).toHaveBeenCalledTimes(2);
});
it('accepts only exact same-repository open PR and merged head evidence',async()=>{
 const pull:Pending={...file,operation:'pull',path:'',expectedBlob:undefined};const merge:Pending={...pull,tool:'github_release',operation:'merge',number:7};
 const pr={number:7,state:'open',head:{ref:branch,sha,repo:{full_name:repo}},base:{ref:'main',repo:{full_name:repo}}};
 const fetchImpl=vi.fn(async(u:RequestInfo|URL)=>Response.json(String(u).includes('/pulls?')?[pr]:{...pr,state:'closed',merged:true,merge_commit_sha:blob}));
 const result=await reconcilePendingGitHubMutations({pending:[pull,merge,{...merge,sha:blob}],allowedRepositories:[repo],fetchImpl});
 expect(result.settled).toEqual([pull,merge]);expect(result.receipts.every(x=>x.kind==='read')).toBe(true);
});
