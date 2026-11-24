// All rows must already be scoped to the authenticated owner by the command boundary.
export const statuses=['scheduled','running','completed','failed','cancelled'] as const;
const scopes=new Set(['all','active','history',...statuses]);
type Row={scheduleId:string;runAt:unknown;status:string;[key:string]:unknown};
export function scheduleListView(rows:readonly Row[],query:URLSearchParams){
 const keys=[...query.keys()];if(keys.some(k=>!['scope','limit','cursor','view'].includes(k))||new Set(keys).size!==keys.length)throw Error('INVALID_SCHEDULE_LIST_QUERY');
 const scope=query.get('scope')??'all',view=query.get('view')??'page';
 const rawLimit=query.get('limit')??'100';
 if(!scopes.has(scope)||!['page','counts'].includes(view)||!/^[1-9]\d{0,2}$/.test(rawLimit)||Number(rawLimit)>200)throw Error('INVALID_SCHEDULE_LIST_QUERY');
 const counts:Record<string,number>={all:rows.length,active:0,history:0,scheduled:0,running:0,completed:0,failed:0,cancelled:0};
 for(const row of rows)if(statuses.some(s=>s===row.status)){counts[row.status]++;if(row.status==='scheduled'||row.status==='running')counts.active++;else counts.history++;}
 const matches=(row:Row)=>scope==='all'||scope===row.status||(scope==='active'&&(row.status==='scheduled'||row.status==='running'))||(scope==='history'&&['completed','failed','cancelled'].includes(row.status));
 const key=(row:Row)=>[String(row.runAt??''),row.scheduleId] as const;
 const compare=(a:readonly string[],b:readonly string[])=>a[0]!<b[0]!?-1:a[0]!>b[0]!?1:a[1]!<b[1]!?-1:a[1]!>b[1]!?1:0;
 let after:string[]|null=null;const token=query.get('cursor');
 if(token){try{if(token.length>800||!/^[A-Za-z0-9_-]+$/.test(token))throw Error();const parsed=JSON.parse(Buffer.from(token,'base64url').toString('utf8'));if(!Array.isArray(parsed)||parsed.length!==3||parsed[0]!==scope||typeof parsed[1]!=='string'||typeof parsed[2]!=='string'||parsed[1].length>100||parsed[2].length>120)throw Error();after=parsed.slice(1);}catch{throw Error('INVALID_SCHEDULE_LIST_QUERY');}}
 if(view==='counts'){if(token)throw Error('INVALID_SCHEDULE_LIST_QUERY');return {ok:true,schedules:[],listMeta:{scope,scopeCounts:counts,nextCursor:null,total:counts[scope]}};}
 const selected=rows.filter(matches).sort((a,b)=>compare(key(a),key(b))).filter(row=>!after||compare(key(row),after)>0);
 const limit=Number(rawLimit),page=selected.slice(0,limit),last=page.at(-1);
 return {ok:true,schedules:page,listMeta:{scope,scopeCounts:counts,total:counts[scope],nextCursor:selected.length>limit&&last?Buffer.from(JSON.stringify([scope,...key(last)])).toString('base64url'):null}};
}
