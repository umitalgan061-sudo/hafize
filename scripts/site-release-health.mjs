// Restore the missing #915 build check without replacing the live Firebase configuration.
import {readFileSync,statSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const rootDir=fileURLToPath(new URL('../',import.meta.url));
export function referencedAssets(html){
 const paths=new Set();
 for(const m of String(html).matchAll(/<(?:script|link|img)\b[^>]*>/gi)){
  for(const attr of m[0].matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)){
   const raw=attr[2];if(!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\'))continue;
   const path=raw.split(/[?#]/)[0];
   if(!/^\/[A-Za-z0-9/_.-]+$/.test(path)||path.split('/').some(s=>s==='..'||s==='.')||path.endsWith('/'))continue;
   paths.add(path);
  }
 }
 return [...paths];
}
export function auditLocalBuild(root=rootDir){
 const dir=resolve(root,'public'),problems=[];
 let html;try{html=readFileSync(resolve(dir,'index.html'),'utf8');}catch{return {ok:false,problems:['INDEX_HTML_MISSING'],checked:0};}
 if(!/\bid=["']composer["']/.test(html))problems.push('HAFIZE_ENTRYPOINT_MISSING');
 const paths=referencedAssets(html);
 if(!paths.includes('/typed-build/app-shell.js'))problems.push('APP_SHELL_REFERENCE_MISSING');
 for(const path of paths){const target=resolve(dir,'.'+path);try{if(!target.startsWith(dir+sep)||!statSync(target).isFile()||!statSync(target).size)throw Error();}catch{problems.push('ASSET_MISSING:'+path);}}
 return {ok:problems.length===0,problems,checked:paths.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=auditLocalBuild();console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}
