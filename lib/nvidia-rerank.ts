/** NVIDIA Build hosted endpoint contract, not the local NIM /v1/ranking API.
 * https://build.nvidia.com/nvidia/nemotron-3_5-rerank-8b/modelcard */
export const RERANK_MODEL='nvidia/nemotron-3.5-rerank-8b';
export const RERANK_URL='https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-3.5-rerank-8b/reranking';
export function rerankPayload(query:string,passages:readonly string[]){
 return {model:RERANK_MODEL,query:{text:query},passages:passages.map(text=>({text}))};
}
export function validateReranking(data:unknown,count:number){
 const raw=(data as {rankings?:unknown})?.rankings;
 if(!Array.isArray(raw)||raw.length!==count)throw Error('MODEL_LAB_INVALID_RERANK_RESPONSE');
 const used=new Set<number>();
 const results=raw.map(row=>{
  if(!row||typeof row!=='object'||!Number.isSafeInteger(row.index)||row.index<0||row.index>=count||used.has(row.index)||typeof row.logit!=='number'||!Number.isFinite(row.logit))throw Error('MODEL_LAB_INVALID_RERANK_RESPONSE');
  used.add(row.index);return {index:row.index as number,logit:row.logit as number};
 });
 return results.sort((a,b)=>b.logit-a.logit||a.index-b.index);
}
