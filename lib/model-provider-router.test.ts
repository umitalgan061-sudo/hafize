import { describe, expect, it } from 'vitest';
import { createModelProviderRouter } from './model-provider-router.ts';

describe('model provider router',()=>{
  it('uses NVIDIA by default',async()=>{
    const router=createModelProviderRouter({nvidiaComplete:async()=> 'nvidia'});
    expect(router.resolve(undefined)).toBe('nvidia');
    expect(await router.complete({payload:{messages:[]}})).toEqual({provider:'nvidia',result:'nvidia'});
  });
  it('requires explicit local enablement',()=>{
    const router=createModelProviderRouter({nvidiaComplete:async()=>'',localComplete:async()=>'',localEnabled:false});
    expect(()=>router.resolve('local')).toThrow('LOCAL_PROVIDER_NOT_ENABLED');
  });
  it('prevents unsupported local tools',()=>{
    const router=createModelProviderRouter({nvidiaComplete:async()=>'',localComplete:async()=>'',localEnabled:true});
    expect(()=>router.resolve('local',{toolsRequired:true})).toThrow('LOCAL_PROVIDER_TOOLS_UNSUPPORTED');
  });
});
