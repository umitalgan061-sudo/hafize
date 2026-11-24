// Search stays on-device and matches canonical conversation identity, not mutable titles.
export const SEARCH_BUDGET=2_000_000;
export const normalizeSearch=(value:unknown)=>typeof value==='string'?value.normalize('NFC').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim():'';
type SearchHit={snippet:string;messageId?:string};
type SearchResult={hits:Map<string,SearchHit>;partial:boolean};
export function searchHistory(conversations:unknown,rawQuery:unknown,budget=SEARCH_BUDGET):SearchResult{
 const hits=new Map<string,SearchHit>();let partial=false;
 const query=normalizeSearch(typeof rawQuery==='string'?rawQuery.slice(0,120):'');
 if(!query||!Array.isArray(conversations))return {hits,partial};
 let remaining=Math.max(0,Math.min(SEARCH_BUDGET,budget));
 for(const row of conversations){
  if(!row||typeof row.id!=='string'||hits.has(row.id))continue;
  if(normalizeSearch(row.title).includes(query)){hits.set(row.id,{snippet:''});continue;}
  const messages=Array.isArray(row.messages)?row.messages:[];
  for(const message of messages){
   if(!message||!['user','assistant'].includes(message.role)||message.worked?.raw||typeof message.content!=='string')continue;
   if(remaining<=0){partial=true;break;}
   const raw=message.content.slice(0,remaining);remaining-=raw.length;
   if(raw.length<message.content.length)partial=true;
   const clean=raw.normalize('NFC').replace(/\s+/g,' ').trim();
   const at=normalizeSearch(clean).indexOf(query);
   if(at<0)continue;
   const start=Math.max(0,at-55),end=Math.min(clean.length,Math.max(at+query.length+55,start+180));
   const snippet=(message.role==='user'?'Sen: ':'Hafize: ')+(start?'…':'')+clean.slice(start,end).slice(0,180)+(end<clean.length?'…':'');
   hits.set(row.id,{snippet,...(typeof message.id==='string'?{messageId:message.id}:{})});break;
  }
 }
 return {hits,partial};
}
export function nextSearchIndex(current:number,count:number,direction:number):number{
 if(!Number.isInteger(count)||count<=0)return -1;
 if(!Number.isInteger(current)||current<0||current>=count)return direction<0?count-1:0;
 return (current+(direction<0?-1:1)+count)%count;
}
