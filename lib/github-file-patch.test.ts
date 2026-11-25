import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createGitHubWorkspaceWriter } from './github-workspace-write.ts';
const sha=(content:string)=>{const bytes=Buffer.from(content,'utf8');return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');};
const repo='owner/repo',branch='hafize/auto-test',path='app.js',commit='b'.repeat(40);
const reply=(value:unknown,status=200)=>({ok:status===200,status,json:async()=>value}) as Response;
function fixture(original:string){
 let saved='';
 const fetchImpl=vi.fn(async (url:URL,init:RequestInit)=>{
  if(url.pathname==='/repos/'+repo)return reply({default_branch:'main'});
  if(init.method==='PUT'){
   const data=JSON.parse(String(init.body));
   expect(data.sha).toBe(sha(original));
   saved=Buffer.from(data.content,'base64').toString('utf8');
   return reply({commit:{sha:commit}});
  }
  const actual=url.searchParams.get('ref')===commit?saved:original;
  return reply({type:'file',encoding:'base64',content:Buffer.from(actual).toString('base64'),sha:sha(actual),size:Buffer.byteLength(actual)});
 });
 const writer=createGitHubWorkspaceWriter({token:'github-test-token',allowedRepositories:[repo],fetchImpl:fetchImpl as unknown as typeof fetch});
 const input={repository:repo,branch,path,existingSha:sha(original),message:'test patch',find:'OLD BLOCK',replace:'NEW BLOCK'};
 return {writer,input,fetchImpl,saved:()=>saved};
}
describe('SHA-bound large file patches',()=>{
 it('preserves all untouched bytes on a file larger than the old 96 KiB limit',async()=>{
  const original='// Türkçe\r\n'+'a'.repeat(106075)+'\r\nOLD BLOCK\r\nend\r\n';
  const {writer,input,saved}=fixture(original);
  const prepared=await writer.prepareFilePatch(input);
  expect(prepared.content).toBe(original.replace('OLD BLOCK','NEW BLOCK'));
  const ticket=writer.issueApproval('file',prepared,true);
  const result=await writer.commitFile(ticket.ticket,prepared);
  const verified=await writer.verifyFileCommit(prepared,result);
  expect(verified).toMatchObject({commitSha:commit,verified:true,blobSha:sha(saved())});
  expect(saved()).toBe(original.replace('OLD BLOCK','NEW BLOCK'));
 });
 it('rejects stale SHA and repeated or missing anchors before committing',async()=>{
  const {writer,input,fetchImpl}=fixture('OLD BLOCK OLD BLOCK');
  await expect(writer.prepareFilePatch({...input,existingSha:'c'.repeat(40)})).rejects.toMatchObject({code:'GITHUB_HEAD_MOVED'});
  await expect(writer.prepareFilePatch(input)).rejects.toMatchObject({code:'GITHUB_PATCH_ANCHOR_NOT_UNIQUE'});
  await expect(writer.prepareFilePatch({...input,find:'not present'})).rejects.toMatchObject({code:'GITHUB_PATCH_ANCHOR_NOT_UNIQUE'});
  expect(fetchImpl.mock.calls.some(([,init])=>init.method==='PUT')).toBe(false);
 });
 it('preserves repository, secret-path, workflow and default branch restrictions',async()=>{
  const {writer,input}=fixture('OLD BLOCK');
  await expect(writer.prepareFilePatch({...input,repository:'other/repo'})).rejects.toMatchObject({code:'GITHUB_REPO_NOT_ALLOWED'});
  await expect(writer.prepareFilePatch({...input,path:'.env'})).rejects.toMatchObject({code:'GITHUB_SENSITIVE_PATH_BLOCKED'});
  await expect(writer.prepareFilePatch({...input,path:'.github/workflows/ci.yml'})).rejects.toMatchObject({code:'GITHUB_WORKFLOW_PATH_BLOCKED'});
  await expect(writer.prepareFilePatch({...input,branch:'main'})).rejects.toMatchObject({code:'GITHUB_DEFAULT_BRANCH_BLOCKED'});
  await expect(writer.prepareFilePatch({...input,replace:'API_KEY = "not-for-commit"'})).rejects.toMatchObject({code:'GITHUB_CONTENT_CREDENTIAL_BLOCKED'});
 });
 it('fails read-back verification on a different blob',async()=>{
  const {writer,input}=fixture('OLD BLOCK');
  const prepared=await writer.prepareFilePatch(input);
  await expect(writer.verifyFileCommit(prepared,{commitSha:commit})).rejects.toMatchObject({code:'GITHUB_COMMIT_VERIFICATION_FAILED'});
 });
});
