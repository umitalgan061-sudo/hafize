import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
/**
 * Last-resort single-file proposal. The owner explicitly names the file;
 * the repository/branch comes from trusted receipts. No write occurs here.
 * A candidate is data, not authority, and still needs the existing writer.
 */
type Target={repository:string;branch:string;path:string};
type Patch={operation:'file';repository:string;branch:string;path:string;existingSha:string;message:string;find:string;replace:string};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function explicitFileEditPath(request:unknown):string|null{
 if(typeof request!=='string')return null;
 const paths=[...new Set(request.match(/(?<![\w./:@\\-])(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:js|mjs|cjs|ts|tsx|jsx|css|html|py|md)(?![\w./:@\\-])/g)??[])];
 if(paths.length!==1)return null;
 const path=paths[0]!;
 if(path.length>400||path.split('/').some(p=>p==='.'||p==='..'||p.startsWith('.')))return null;
 return path;
}
export function exactFileSnapshot(target:Target,value:unknown):{sha:string;content:string}|null{
 const v=obj(value);
 if(v.repository!==target.repository||v.ref!==target.branch||v.path!==target.path||v.truncated!==false||typeof v.sha!=='string'||!/^[a-f0-9]{40}$/i.test(v.sha)||typeof v.content!=='string'||!v.content.trim()||v.content.length>48000||v.startLine!==undefined||v.endLine!==undefined)return null;
 const bytes=Buffer.from(v.content,'utf8');
 if(typeof v.size!=='number'||bytes.length!==v.size||v.content.includes('\0')||bytes.toString('utf8')!==v.content)return null;
 // Verify the actual Git blob, not just the reported size and SHA shape.
 const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(blob!==v.sha.toLowerCase())return null;
 return {sha:blob,content:v.content};
}
export type PatchRejection='no_proposal'|'invalid_json'|'invalid_shape'|'invalid_block'|'missing_anchor'|'ambiguous_anchor'|'invalid_syntax'|'generation_incomplete';
type PatchInspection={patch:Patch;reason:null}|{patch:null;reason:PatchRejection};
const reject=(reason:PatchRejection):PatchInspection=>({patch:null,reason});
function parsesScript(source:string):boolean{
 try{new Script(source);return true;}catch{return false;}
}
/** Only a classic JS baseline that parses can establish this syntax gate.
 * ES modules and other languages still rely on their own CI checks.
 * Script compilation never evaluates repository or model-generated code. */
export function inspectFilePatch(target:Target,snapshot:{sha:string;content:string},answer:unknown):PatchInspection{
 if(typeof answer!=='string'||answer.length>65000)return reject('invalid_json');
 let raw=answer.trim().replace(/^<think>[\s\S]*?<\/think>\s*/i,'');
 raw=raw.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i,'$1');
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{return reject('invalid_json');}
 if(parsed===null)return reject('no_proposal');
 const v=obj(parsed);
 if(Object.keys(v).length!==2||typeof v.find!=='string'||typeof v.replace!=='string')return reject('invalid_shape');
 const {find,replace}=v;
 if(!find.trim()||!replace.trim()||find===replace||find.length>16000||replace.length>24000||find.includes('\0')||replace.includes('\0'))return reject('invalid_block');
 const at=snapshot.content.indexOf(find);
 if(at<0)return reject('missing_anchor');
 if(snapshot.content.indexOf(find,at+1)>=0)return reject('ambiguous_anchor');
 const candidate=snapshot.content.slice(0,at)+replace+snapshot.content.slice(at+find.length);
 if(/\.(?:js|cjs)$/i.test(target.path)&&parsesScript(snapshot.content)&&!parsesScript(candidate))return reject('invalid_syntax');
 return {patch:{operation:'file',...target,existingSha:snapshot.sha,message:'Implement requested source improvement',find,replace},reason:null};
}
export function validatedFilePatch(target:Target,snapshot:{sha:string;content:string},answer:unknown):Patch|null{
 return inspectFilePatch(target,snapshot,answer).patch;
}
export function patchRepairInstruction(reason:PatchRejection):string{
 const instructions:Record<PatchRejection,string>={
  no_proposal:'No safe proposal was supplied.',
  invalid_json:'Return a single complete JSON object, with properly escaped strings.',
  invalid_shape:'Return exactly two string keys: find and replace. Do not include other keys.',
  invalid_block:'Return a meaningful changed code block within the size limits; do not return identical or empty text.',
  missing_anchor:'Copy the find block verbatim from the provided source; do not reconstruct or paraphrase it.',
  ambiguous_anchor:'Choose a longer exact find block that occurs only once in the provided source.',
  invalid_syntax:'The replacement made the complete JavaScript file syntactically invalid. Preserve balanced delimiters and valid statements.',
  generation_incomplete:'Return a smaller self-contained edit that fits within the completion budget.'
 };
 return instructions[reason];
}

/** A truncated or filtered generation must never become a write, even
 * if the visible fragment happens to parse as JSON. Older compatible
 * streams omit the finish reason; the strict full JSON parser still applies. */
export function patchCompletionAccepted(reason:unknown):boolean{
 return reason===''||reason==='stop'||reason==='end_turn';
}
