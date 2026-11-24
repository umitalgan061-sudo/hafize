/** Kimi K3.1 Pro API contract: chat/completions, seed, max_tokens, stream,
 * reasoning_effort, messages and optional tools. Do not send unlisted knobs. */
export const KIMI_K31_PRO='moonshotai/kimi-k3.1-pro';
export function modelLabChatPayload(body:Record<string,unknown>):Record<string,unknown>{
 if(body.model!==KIMI_K31_PRO)return body;
 const {temperature:_temperature,tool_choice:_toolChoice,...rest}=body;
 return {...rest,seed:0,reasoning_effort:'low',max_tokens:Math.max(1024,typeof rest.max_tokens==='number'?rest.max_tokens:0)};
}
/** A laboratory success is not a production streaming/delegation compatibility check. */
export function productionLabCandidates(ids:readonly string[]):string[]{
 return ids.filter(id=>id!==KIMI_K31_PRO);
}
