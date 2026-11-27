import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {explicitFileEditPath,exactFileSnapshot,validatedFilePatch,patchCompletionAccepted} from './agent-file-patch-proposal.ts';
const target={repository:'umitalgan061-sudo/hafize',branch:'hafize/auto-example',path:'public/home-voice-luminous-core.js'};
const source='const glow = 0.3;\nconst radius = 20;\n';
const sha=createHash('sha1').update('blob '+Buffer.byteLength(source)+'\0').update(source).digest('hex');
const value={repository:target.repository,path:target.path,ref:target.branch,sha,content:source,truncated:false,size:Buffer.byteLength(source)};
describe('explicit file patch proposal',()=>{
 it('selects exactly one explicit source path',()=>{
  expect(explicitFileEditPath('Hafize, güncel main dalından yeni bir geliştirme dalı oluştur. public/home-voice-luminous-core.js dosyasını kendi yaratıcılığınla geliştir ve commit et.')).toBe(target.path);
  expect(explicitFileEditPath('public/a.js ve public/b.js dosyalarını düzenle')).toBeNull();
  expect(explicitFileEditPath('Kaldığın yerden devam et.')).toBeNull();
  expect(explicitFileEditPath('https://github.com/a/b/blob/main/public/a.js')).toBeNull();
  expect(explicitFileEditPath('.github/workflows/deploy.js')).toBeNull();
 });
 it('requires an exact complete branch snapshot',()=>{
  expect(exactFileSnapshot(target,value)).toEqual({sha,content:source});
  for(const changes of [{ref:'main'},{path:'public/other.js'},{repository:'other/repo'},{truncated:true},{sha:'bad'},{sha:'a'.repeat(40)},{content:source.replace('0.3','0.4')},{size:1},{startLine:1},{endLine:2}])expect(exactFileSnapshot(target,{...value,...changes})).toBeNull();
 });
 it('validates a real unique edit and constructs only the scoped file operation',()=>{
  const snapshot={sha,content:source};
  const answer=JSON.stringify({find:'const glow = 0.3;',replace:'const glow = 0.7;'});
  expect(validatedFilePatch(target,snapshot,answer)).toEqual({operation:'file',...target,existingSha:sha,message:'Implement requested source improvement',find:'const glow = 0.3;',replace:'const glow = 0.7;'});
  expect(validatedFilePatch(target,snapshot,'<think>draft</think>\n'+answer)).not.toBeNull();
  for(const invalid of ['null','not json',JSON.stringify({find:'absent',replace:'new'}),JSON.stringify({find:'const',replace:'let'}),JSON.stringify({find:'0.3',replace:'0.3'}),JSON.stringify({find:'0.3',replace:''}),JSON.stringify({find:'0.3',replace:'0.7',branch:'main'})])expect(validatedFilePatch(target,snapshot,invalid)).toBeNull();
 });
});

it('rejects incomplete model generations and binary edit candidates',()=>{
 for(const reason of ['length','content_filter','tool_calls','error',null,undefined])expect(patchCompletionAccepted(reason)).toBe(false);
 for(const reason of ['','stop','end_turn'])expect(patchCompletionAccepted(reason)).toBe(true);
 expect(validatedFilePatch(target,{sha,content:source},JSON.stringify({find:'0.3',replace:'0.4\0'}))).toBeNull();
});
