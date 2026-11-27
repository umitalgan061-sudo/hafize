import {createHash} from 'node:crypto';
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
 const paths=[...new Set(request.match(/(?<![\w./-])(?:[A-Za-z0-9_-]+\/)+[A-Za-z0-9_.-]+\.(?:js|mjs|cjs|ts|tsx|jsx|css|html|py|md)(?![\w./-])/g)??[])];
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
export function validatedFilePatch(target:Target,snapshot:{sha:string;content:string},answer:unknown):Patch|null{
 if(typeof answer!=='string'||answer.length>65000)return null;
 let raw=answer.trim().replace(/^<think>[\s\S]*?<\/think>\s*/i,'');
 raw=raw.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i,'$1');
 let v:Record<string,unknown>;
 try{v=obj(JSON.parse(raw));}catch{return null;}
 if(Object.keys(v).length!==2||typeof v.find!=='string'||typeof v.replace!=='string')return null;
 const {find,replace}=v;
 if(!find.trim()||!replace.trim()||find===replace||find.length>16000||replace.length>24000||find.includes('\0')||replace.includes('\0'))return null;
 const at=snapshot.content.indexOf(find);
 if(at<0||snapshot.content.indexOf(find,at+1)>=0)return null;
 return {operation:'file',...target,existingSha:snapshot.sha,message:'Implement requested source improvement',find,replace};
}

/** A truncated or filtered generation must never become a write, even
 * if the visible fragment happens to parse as JSON. Older compatible
 * streams omit the finish reason; the strict full JSON parser still applies. */
export function patchCompletionAccepted(reason:unknown):boolean{
 return reason===''||reason==='stop'||reason==='end_turn';
}
