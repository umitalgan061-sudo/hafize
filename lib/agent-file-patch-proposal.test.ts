import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {explicitFileEditPath,exactFileSnapshot,validatedFilePatch,inspectFilePatch,patchRepairInstruction,patchCompletionAccepted} from './agent-file-patch-proposal.ts';
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

it('resolves explicit root files and rejects mixed root/nested or unsafe paths',()=>{
 expect(explicitFileEditPath('app.js dosyasını düzenle ve commit et')).toBe('app.js');
 expect(explicitFileEditPath('app.js ve public/a.js dosyalarını düzenle')).toBeNull();
 expect(explicitFileEditPath('C:\\public\\app.js dosyasını düzenle')).toBeNull();
 expect(explicitFileEditPath('https://example.org/app.js dosyasını düzenle')).toBeNull();
 expect(explicitFileEditPath('../app.js dosyasını düzenle')).toBeNull();
 expect(explicitFileEditPath('public/a.js, public/a.js dosyasını düzenle')).toBe('public/a.js');
});
it('diagnoses model output without exposing source or running generated code',()=>{
 const snapshot={sha,content:source};
 const result=(find:string,replace:string)=>inspectFilePatch(target,snapshot,JSON.stringify({find,replace}));
 expect(inspectFilePatch(target,snapshot,'null').reason).toBe('no_proposal');
 expect(inspectFilePatch(target,snapshot,'broken JSON').reason).toBe('invalid_json');
 expect(inspectFilePatch(target,snapshot,'{"find":"0.3","replace":1}').reason).toBe('invalid_shape');
 expect(result('0.3','0.3').reason).toBe('invalid_block');
 expect(result('not in source','new').reason).toBe('missing_anchor');
 expect(result('const','let').reason).toBe('ambiguous_anchor');
 expect(result('0.3','(').reason).toBe('invalid_syntax');
 expect(result('0.3','0.7').reason).toBeNull();
 expect(result('const glow = 0.3;','throw new Error("not executed");').patch).not.toBeNull();
 const moduleSource='export const glow = 0.3;';
 expect(inspectFilePatch(target,{sha,content:moduleSource},JSON.stringify({find:'0.3',replace:'0.7'})).patch).not.toBeNull();
 expect(patchRepairInstruction('missing_anchor')).toContain('verbatim');
 expect(patchRepairInstruction('invalid_syntax')).not.toContain(source);
});
