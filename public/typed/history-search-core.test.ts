import {describe,it,expect} from 'vitest';
import {searchHistory,nextSearchIndex} from './history-search-core.ts';
describe('canonical conversation search',()=>{
 it('distinguishes same-titled conversations and matches Turkish text',()=>{
  const r=searchHistory([{id:'a',title:'Sohbet',messages:[{id:'m',role:'user',content:'İstanbul haritası'}]},{id:'b',title:'Sohbet',messages:[{role:'assistant',content:'Ankara'}]}],'istanbul');
  expect([...r.hits.keys()]).toEqual(['a']);expect(r.hits.get('a')).toEqual({snippet:'Sen: İstanbul haritası',messageId:'m'});
 });
 it('excludes raw background output and reports truncated scan',()=>{
  const r=searchHistory([{id:'a',messages:[{role:'assistant',worked:{raw:true},content:'private needle'},{role:'user',content:'aaaa needle'}]}],'needle',4);
  expect(r.partial).toBe(true);expect(r.hits.size).toBe(0);
 });
 it('bounds snippets and handles titles without revealing other messages',()=>{
  const r=searchHistory([{id:'a',title:'needle',messages:[{role:'user',content:'private'}]},{id:'b',messages:[{role:'assistant',content:'a'.repeat(300)+' needle '+'b'.repeat(300)}]}],'needle');
  expect(r.hits.get('a')?.snippet).toBe('');expect(r.hits.get('b')?.snippet.length).toBeLessThan(195);
 });
 it('wraps keyboard navigation and handles empty results',()=>{expect(nextSearchIndex(-1,2,-1)).toBe(1);expect(nextSearchIndex(1,2,1)).toBe(0);expect(nextSearchIndex(0,0,1)).toBe(-1);});
});
