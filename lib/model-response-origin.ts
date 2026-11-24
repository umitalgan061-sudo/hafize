// Keep trusted routing identity internal; do not trust an upstream body or expose private metadata.
const origins=new WeakMap<object,string>();
export function markCompletionOrigin(value:unknown,model:unknown):void{
 if(value&&typeof value==='object'&&typeof model==='string'&&model.trim()&&model.length<=260)origins.set(value,model);
}
export function completionOrigin(value:unknown):string|null{
 return value&&typeof value==='object'?origins.get(value)??null:null;
}
