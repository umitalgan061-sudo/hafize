import {it,expect} from 'vitest';
import {PUBLIC_MODEL_CATALOG,publicModelInventory,PUBLIC_CATALOG_METADATA} from './nvidia-public-inventory.ts';
it('retains the operator supplied catalog without fabricating endpoint identifiers or access',()=>{
 expect(PUBLIC_MODEL_CATALOG).toHaveLength(93);expect(PUBLIC_MODEL_CATALOG.filter(r=>r.freeEndpoint)).toHaveLength(38);expect(PUBLIC_MODEL_CATALOG.filter(r=>r.downloadable)).toHaveLength(72);expect(new Set(PUBLIC_MODEL_CATALOG.map(r=>r.publisher+'/'+r.name)).size).toBe(93);
 expect(PUBLIC_CATALOG_METADATA.reportedTotal).toBe(93);
 const inventory=publicModelInventory(['google/gemma-4-31b-it'],['nvidia/nemotron-3.5-embed-8b'],[],[]);
 expect(inventory.find(r=>r.name==='gemma-4-31b-it')).toMatchObject({configured:true,evidence:'untested',cost:'unknown'});
 expect(inventory.find(r=>r.name==='nemotron-3.5-embed-8b')).toMatchObject({configured:true});
 expect(inventory.find(r=>r.name==='Kumo Tabular')).toMatchObject({apiId:null,configured:false});
 expect(inventory.every(r=>r.evidence==='untested')).toBe(true);
});
