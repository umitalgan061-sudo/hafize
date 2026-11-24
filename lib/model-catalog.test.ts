
import {describe,it,expect} from 'vitest';
import {classifyModel,catalogInventory} from './model-catalog.ts';
describe('model catalog inventory',()=>{
  it.each([
    ['nvidia/nemotron-3.5-embed-8b','embedding'],['nvidia/nemotron-3.5-rerank-8b','rerank'],
    ['nvidia/nemotron-3.5-parse','document'],['nvidia/nemotron-transcribe','asr'],
    ['nvidia/magpie-tts','tts'],['nvidia/riva-translate-4b','translation'],
    ['black-forest-labs/flux.2-klein-4b','image'],['nvidia/nemotron-3.5-super-vl-120b-a12b','vision'],
    ['nvidia/nemotron-3-ultra-550b-a55b','chat'],['moonshotai/kimi-k3.1-pro','chat'],
    ['vendor/new-model','unknown']
  ])('classifies %s without assuming endpoint access',(id,kind)=>expect(classifyModel(id)).toEqual([kind]));
  it('separates discovery, configuration, tested access and unknown pricing',()=>{
    const a='vendor/model-a',b='vendor/model-b';
    expect(catalogInventory([a],[b],[{model:b,status:'passed',chat:true}])).toEqual([
      {id:a,capabilities:['unknown'],listed:true,configured:false,evidence:'untested',cost:'unknown'},
      {id:b,capabilities:['unknown'],listed:false,configured:true,evidence:'chat_test_passed',cost:'unknown'}
    ]);
  });
});
