/** Kimi K3.1 Pro API contract: chat/completions, seed, max_tokens, stream,
 * reasoning_effort, messages and optional tools. Do not send unlisted knobs. */
export const KIMI_K31_PRO='moonshotai/kimi-k3.1-pro';
export const GEMMA_4='google/gemma-4-31b-it';
export const OMNI='nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
// These published text contracts do not document function-call request fields.
export const textOnlyLabModel=(id:unknown)=>id===GEMMA_4||id===OMNI;
export function modelLabChatPayload(body:Record<string,unknown>):Record<string,unknown>{
 if(textOnlyLabModel(body.model)){const {tools:_tools,tool_choice:_choice,...rest}=body;return {...rest,max_tokens:Math.max(1024,Number(rest.max_tokens)||0),seed:0,...(body.model===OMNI?{reasoning_budget:256}:{})};}
 if(body.model!==KIMI_K31_PRO)return body;
 const {temperature:_temperature,tool_choice:_toolChoice,...rest}=body;
 return {...rest,seed:0,reasoning_effort:'low',max_tokens:Math.max(1024,typeof rest.max_tokens==='number'?rest.max_tokens:0)};
}
/** A laboratory success is not a production streaming/delegation compatibility check. */
export function productionLabCandidates(ids:readonly string[]):string[]{
 return ids.filter(id=>id!==KIMI_K31_PRO&&!textOnlyLabModel(id));
}

/** Only the exact Kimi chat test uses a longer first-response allowance. */
export function modelLabRequestTimeout(path:string,body:Record<string,unknown>|null):number{return path==='/chat/completions'&&body?.model===KIMI_K31_PRO?90_000:35_000;}
