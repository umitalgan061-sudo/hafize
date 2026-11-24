import type {createModelLab} from './model-lab.ts';
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/;
export async function modelLabAction(lab:ReturnType<typeof createModelLab>,input:unknown,signal?:AbortSignal){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('MODEL_LAB_INVALID_ACTION');
  const body=input as Record<string,unknown>;
  if(Object.keys(body).some(key=>!['action','model'].includes(key)))throw Error('MODEL_LAB_INVALID_ACTION');
  const action=body.action;
  if(action==='discover'||action==='batch'||action==='comprehensive'){
    if(body.model!==undefined)throw Error('MODEL_LAB_INVALID_ACTION');
    if(action==='discover')await lab.discover(signal);else if(action==='comprehensive'){const comprehensive=await lab.comprehensive(signal);return {...lab.status(),comprehensive};}else await lab.batch(signal);
  }else if(action==='probe'||action==='deep'||action==='specialist'){
    if(typeof body.model!=='string'||!ID.test(body.model))throw Error('MODEL_LAB_INVALID_ACTION');
    if(action==='probe')await lab.probe(body.model,signal);
    else if(action==='deep')await lab.deepProbe(body.model,signal);
    else await lab.specialistProbe(body.model,signal);
  }else throw Error('MODEL_LAB_INVALID_ACTION');
  return lab.status();
}
