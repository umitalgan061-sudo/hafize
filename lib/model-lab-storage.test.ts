import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createModelLabFileStorage } from './model-lab-storage.ts';
describe('model lab file store',()=>{
  it('writes scoped snapshots, rejects mismatched keys, omits credentials',()=>{
    const dir=mkdtempSync(join(tmpdir(),'hafize-lab-'));
    try {
      const path=join(dir,'lab.json');
      const snapshot={version:1 as const,results:[],deepResults:[],timestamps:[1],blockedUntil:0};
      const store=createModelLabFileStorage(path,'secret-test-key',['nvidia/example']);
      expect(store.load()).toBeNull();
      store.save(snapshot);
      expect(store.load()).toEqual(snapshot);
      expect(readFileSync(path,'utf8')).not.toContain('secret-test-key');
      expect(createModelLabFileStorage(path,'different-key',['nvidia/example']).load()).toBeNull();
      writeFileSync(path,'bad json');
      expect(()=>store.load()).toThrow();
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
});

import {openHafizeDb} from './hafize-db.ts';
import {createModelLab} from './model-lab.ts';
import {createModelLabSqliteStorage} from './model-lab-storage.ts';
it('retains specialist observations across restart and never restores stale routing eligibility',async()=>{
  const db=openHafizeDb(':memory:');let clock=100000;
  const allowed=['nvidia/a','nvidia/b','nvidia/c'];const model='nvidia/nemotron-3-embed-1b';
  const storage=createModelLabSqliteStorage(db,'test-key',[...allowed,model]);
  const request=async(path:string,body:Record<string,unknown>|null)=>new Response(JSON.stringify(path==='/embeddings'?{data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[0,1]}]}:{choices:[{message:body?.tools?{tool_calls:[{function:{name:'benchmark_echo',arguments:'{"value":42}'}}]}:{content:'{"capital":"Ankara","math":383,"code":12}'}}]}));
  const options={allowed,request,now:()=>clock,specialistModels:[model]};
  const lab=createModelLab(options);lab.attachStorage(storage);
  await lab.batch();await lab.specialistProbe(model);
  clock+=86400000;
  const next=createModelLab({...options,storage});
  expect(next.status().specialistResults).toHaveLength(1);
  expect(next.preferred('general',allowed)).toEqual([]);
  expect(next.status().results).toEqual([]);
  expect(next.status().historicalResults.map(row=>row.model)).toEqual(['nvidia/a','nvidia/b']);
  expect((await next.batch()).completed.map(row=>row.model)).toEqual(['nvidia/c','nvidia/a']);
  expect(createModelLabSqliteStorage(db,'new-key',[...allowed,model]).load()).toBeNull();
  db.close();
});
