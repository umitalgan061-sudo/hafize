import type {createModelLab} from './model-lab.ts';
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/;
export async function modelLabAction(lab:ReturnType<typeof createModelLab>,input:unknown,signal?:AbortSignal){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('MODEL_LAB_INVALID_ACTION');
  const body=input as Record<string,unknown>;
  if(body.action==='rerank_text'){
    if(Object.keys(body).some(key=>!['action','text','query','consent'].includes(key))||body.consent!==true)throw Error('MODEL_LAB_INVALID_ACTION');
    const rerankOutput=await lab.rankText(body.text,body.query,signal);return {...lab.status(),rerankOutput};
  }
  if(body.action==='semantic_search'){
    if(Object.keys(body).some(key=>!['action','text','query','model','consent'].includes(key))||body.consent!==true)throw Error('MODEL_LAB_INVALID_ACTION');
    const semanticOutput=await lab.semanticSearch(body.text,body.query,body.model,signal);return {...lab.status(),semanticOutput};
  }
  if(body.action==='translate_text'){
    if(Object.keys(body).some(key=>!['action','text','pair','consent'].includes(key))||body.consent!==true)throw Error('MODEL_LAB_INVALID_ACTION');
    const translationOutput=await lab.translateText(body.text,body.pair,signal);return {...lab.status(),translationOutput};
  }
  if(Object.keys(body).some(key=>!['action','model'].includes(key)))throw Error('MODEL_LAB_INVALID_ACTION');
  const action=body.action;
  if(action==='discover'||action==='batch'||action==='comprehensive'||action==='translation'||action==='rerank_probe'||action==='audit_window'){
    if(body.model!==undefined)throw Error('MODEL_LAB_INVALID_ACTION');
    if(action==='discover')await lab.discover(signal);else if(action==='rerank_probe'){const reranking=await lab.rerankProbe(signal);return {...lab.status(),reranking};}else if(action==='audit_window'){const audit=await lab.auditWindow(signal);return {...lab.status(),audit};}else if(action==='translation'){const translation=await lab.translationProbe(signal);return {...lab.status(),translation};}else if(action==='comprehensive'){const comprehensive=await lab.comprehensive(signal);return {...lab.status(),comprehensive};}else await lab.batch(signal);
  }else if(action==='probe'||action==='deep'||action==='specialist'){
    if(typeof body.model!=='string'||!ID.test(body.model))throw Error('MODEL_LAB_INVALID_ACTION');
    if(action==='probe')await lab.probe(body.model,signal);
    else if(action==='deep')await lab.deepProbe(body.model,signal);
    else await lab.specialistProbe(body.model,signal);
  }else throw Error('MODEL_LAB_INVALID_ACTION');
  return lab.status();
}
