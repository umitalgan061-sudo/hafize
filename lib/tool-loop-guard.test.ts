import { describe, expect, it } from 'vitest';
import { createToolLoopGuard } from './tool-loop-guard.ts';

describe('createToolLoopGuard', () => {
  it('allows a call once and blocks an identical retry', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('fs_read', '{"path":"README.md"}')).toBe(true);
    expect(guard.shouldRun('fs_read', '{"path":"README.md"}')).toBe(false);
  });
  it('does not block a different call', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('fs_read', '{"path":"README.md"}')).toBe(true);
    expect(guard.shouldRun('fs_read', '{"path":"package.json"}')).toBe(true);
  });
});

describe('long-run duplicate detection', () => {
  it('blocks semantically equal JSON with reordered nested keys and whitespace', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('github_read_file', '{"repo":"example","options":{"ref":"main","path":"app.ts"}}')).toBe(true);
    expect(guard.shouldRun('github_read_file', '{ "options": { "path":"app.ts", "ref":"main" }, "repo":"example" }')).toBe(false);
  });
  it('preserves array ordering and distinct mutations', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('tool', '{"items":[1,2]}')).toBe(true);
    expect(guard.shouldRun('tool', '{"items":[2,1]}')).toBe(true);
    expect(guard.shouldRun('tool', '{"items":[1,2]}')).toBe(false);
  });
  it('does not confuse prototype keys or malformed arguments', () => {
    const guard = createToolLoopGuard();
    expect(guard.shouldRun('tool', '{"__proto__":{"x":1}}')).toBe(true);
    expect(guard.shouldRun('tool', '{}')).toBe(true);
    expect(guard.shouldRun('tool', '{"__proto__":{"x":1}}')).toBe(false);
    expect(guard.shouldRun('tool', '{broken')).toBe(true);
    expect(guard.shouldRun('tool', '{broken')).toBe(false);
  });
});

it('permits fresh mutable repository reads after verified changes, not duplicate writes or immutable reads',()=>{const g=createToolLoopGuard(),repository='owner/repo',sha='a'.repeat(40),blob='b'.repeat(40);const read=JSON.stringify({repository,path:'app.js',ref:'hafize/auto-test'}),immutable=JSON.stringify({repository,path:'app.js',ref:sha}),other=JSON.stringify({repository:'owner/other',path:'app.js',ref:'main'}),write=JSON.stringify({repository,operation:'file',path:'app.js'}),inspect=JSON.stringify({repository,action:'pulls'});for(const [n,a] of [['github_read_file',read],['github_read_file',immutable],['github_read_file',other],['github_develop',write],['github_inspect',inspect]])expect(g.shouldRun(n,a)).toBe(true);g.observeGitHubMutation('github_develop',{ok:false,value:{repository,action:'file',verified:true,commitSha:sha,blobSha:blob}});expect(g.shouldRun('github_read_file',read)).toBe(false);g.observeGitHubMutation('github_develop',{ok:true,value:{repository,action:'file',verified:true,commitSha:sha,blobSha:blob}});expect(g.shouldRun('github_read_file',read)).toBe(true);expect(g.shouldRun('github_read_file',read)).toBe(false);expect(g.shouldRun('github_inspect',inspect)).toBe(true);expect(g.shouldRun('github_read_file',immutable)).toBe(false);expect(g.shouldRun('github_read_file',other)).toBe(false);expect(g.shouldRun('github_develop',write)).toBe(false);g.observeGitHubMutation('github_develop',{ok:true,value:{repository,action:'pull',number:2,headSha:sha,existing:true}});expect(g.shouldRun('github_inspect',inspect)).toBe(false);});


describe('mutation receipt replay protection', () => {
  it('normalizes structured arguments without conflating different paths', () => {
    const g = createToolLoopGuard();
    expect(g.shouldRun('github_read_file', {repository:'owner/repo',path:'a.ts'})).toBe(true);
    expect(g.shouldRun('github_read_file', {repository:'owner/repo',path:'b.ts'})).toBe(true);
    expect(g.shouldRun('github_read_file', '{"path":"a.ts","repository":"owner/repo"}')).toBe(false);
  });
  it('allows exactly one refresh per new commit, even with a replayed receipt', () => {
    const g=createToolLoopGuard(),repository='owner/repo',args={repository,path:'app.ts',ref:'main'};
    const receipt={ok:true,value:{repository,action:'file',verified:true,commitSha:'a'.repeat(40),blobSha:'b'.repeat(40)}};
    expect(g.shouldRun('github_read_file',args)).toBe(true);
    g.observeGitHubMutation('github_develop',receipt);
    expect(g.shouldRun('github_read_file',args)).toBe(true);
    g.observeGitHubMutation('github_develop',receipt);
    expect(g.shouldRun('github_read_file',args)).toBe(false);
    g.observeGitHubMutation('github_develop',{...receipt,value:{...receipt.value,commitSha:'c'.repeat(40)}});
    expect(g.shouldRun('github_read_file',args)).toBe(true);
  });
  it('deduplicates pull and open aliases for the same pull request', () => {
    const g=createToolLoopGuard(),repository='owner/repo',args={repository,action:'pulls'};
    const value={repository,number:7,headSha:'a'.repeat(40)};
    expect(g.shouldRun('github_inspect',args)).toBe(true);
    g.observeGitHubMutation('github_develop',{ok:true,value:{...value,action:'pull'}});
    expect(g.shouldRun('github_inspect',args)).toBe(true);
    g.observeGitHubMutation('github_release',{ok:true,value:{...value,action:'open'}});
    expect(g.shouldRun('github_inspect',args)).toBe(false);
  });
});
