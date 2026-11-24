export type ModelCapability = 'chat'|'vision'|'embedding'|'rerank'|'document'|'image'|'video'|'asr'|'tts'|'translation'|'audio'|'safety'|'unknown';
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/;
const KNOWN_CHAT = /^(?:nemotron-3(?:\.5)?-(?:ultra|bolt|lightning|super|nano)(?:-|$)|kimi-k|mistral-(?:large|small)|minimax-m|step-5|glm-5|laguna-|deepseek-v|llama-[\d.]+-.*instruct|qwen[\d.]+-.*instruct)/i;
export function classifyModel(id: string): ModelCapability[] {
  if (!ID.test(id)) return ['unknown'];
  const name=id.split('/')[1]!.toLowerCase();
  if (/guard|safety/.test(name)) return ['safety'];
  if (/rerank/.test(name)) return ['rerank'];
  if (/embed|nvclip|^bge-/.test(name)) return ['embedding'];
  if (/ocr|(?:^|[-.])parse(?:[-.]|$)|table[-_]structure/.test(name)) return ['document'];
  if (/transcri|parakeet|whisper|(?:^|[-.])asr(?:[-.]|$)/.test(name)) return ['asr'];
  if (/magpie|studio[-_]voice|(?:^|[-.])tts(?:[-.]|$)/.test(name)) return ['tts'];
  if (/translate|translation|(?:^|[-.])nmt(?:[-.]|$)/.test(name)) return ['translation'];
  if (/noise[-_]remov|audio[-_]enhanc/.test(name)) return ['audio'];
  if (/wan[-.]|(?:^|[-.])video[-.]gen/.test(name)) return ['video'];
  if (/flux|stable[-_]diffusion|image[-_]edit|image[-_]gen/.test(name)) return ['image'];
  if (/cosmos[-_]reason|muse[-_]glimmer|(?:^|[-.])(?:vision|vl|omni)(?:[-.]|$)/.test(name)) return ['vision'];
  if (KNOWN_CHAT.test(name)) return ['chat'];
  return ['unknown'];
}
export function catalogInventory(ids: readonly string[], eligible: readonly string[], observed: readonly {model:string;status:string;chat:boolean}[]) {
  const rows = [...new Set([...ids,...eligible])].filter(id=>ID.test(id)).slice(0,530).map(id=>{
    const observation=observed.find(row=>row.model===id);
    const capabilities=classifyModel(id);
    return {id,capabilities,listed:ids.includes(id),configured:eligible.includes(id),evidence:observation ? observation.chat && observation.status==='passed' ? 'chat_test_passed' : observation.status : 'untested',cost:'unknown' as const};
  });
  return rows;
}
