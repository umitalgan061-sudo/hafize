// Local deterministic adaptations; no NVIDIA container, no network, no execution of pasted instructions.
export function checkMarkdown(input:string){
 const lines=input.slice(0,20000).split(/\r?\n/);const issues:string[]=[];const seen=new Set<string>();let previous=0;let headings=0;let fence=false;
 for(const [i,line] of lines.entries()){
  if(/^\s*(?:```|~~~)/.test(line)){fence=!fence;continue;}if(fence)continue;
  const match=/^(#{1,6})\s+(.+)$/.exec(line);if(match){headings++;const depth=match[1]!.length;const title=match[2]!.trim().toLocaleLowerCase('tr-TR');if(previous&&depth>previous+1)issues.push('Satır '+(i+1)+': başlık düzeyi atlanmış.');if(seen.has(title))issues.push('Satır '+(i+1)+': yinelenen başlık.');seen.add(title);previous=depth;}
  if(/\b(?:TODO|FIXME|TBD)\b/i.test(line))issues.push('Satır '+(i+1)+': tamamlanmamış iş notu.');
 }
 if(!headings)issues.unshift('Markdown başlığı bulunamadı.');if(fence)issues.push('Kapanmamış kod bloğu olabilir.');
 return {lines:lines.length,headings,issues:issues.slice(0,60),truncated:issues.length>60};
}
const words=(text:string)=>text.toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}]{2,}/gu)??[];
export function searchPassages(input:string,query:string){
 const terms=[...new Set(words(query.slice(0,500)))];if(!terms.length)return [];
 return input.slice(0,20000).split(/\r?\n\s*\r?\n/).slice(0,100).map((text,index)=>{const tokens=new Set(words(text));const matches=terms.filter(t=>tokens.has(t));return {source:index+1,text:text.trim().slice(0,1500),matches:matches.length,score:matches.length/terms.length};}).filter(row=>row.matches&&row.text).sort((a,b)=>b.score-a.score||a.source-b.source).slice(0,5);
}
export function evaluateCases(input:string){
 // One synthetic case per line: expected | actual. Exact-match only; no inference.
 const lines=input.slice(0,20000).split(/\r?\n/).filter(l=>l.trim()).slice(0,100);let invalid=0;
 const cases=lines.flatMap((line,index)=>{const parts=line.split('|');if(parts.length!==2||!parts[0]!.trim()||!parts[1]!.trim()){invalid++;return [];}return [{case:index+1,passed:parts[0]!.trim()===parts[1]!.trim()}];});
 return {total:cases.length,passed:cases.filter(c=>c.passed).length,invalid,cases};
}
