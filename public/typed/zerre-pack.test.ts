import {describe,it,expect} from 'vitest';
import {zerrePhonemes} from './zerre-phonemes.ts';
import {zerrePack,zerreStyles} from './zerre-pack.ts';
const lexicon={symbols:['<pad>','<bos>','<eos>','<sp>','m','e','ɾ','h','a','b','i','ɯ','k','.','?'],words:{merhaba:['m e ɾ h a b a','0001000'] as [string,string]}};
describe('Zerre local Turkish pack',()=>{
  it('offers two distinct neutral speaker IDs and pinned assets',()=>{
    expect(zerreStyles).toEqual(['SES-A','SES-B']);
    expect(zerrePack.speakers).toBe(2);
    expect(zerrePack.size).toBe(9724638);
    expect(zerrePack.url).toContain('cf3cdfaaa54a9e8ec541081bb5c2e97c3d563db4');
  });
  it('creates compatible aligned token and stress arrays using a real lexicon entry',()=>{
    const x=zerrePhonemes('MERHABA.',lexicon);
    expect(x.ids).toEqual([1,4,5,6,7,8,9,8,13,2]);
    expect(x.stress).toHaveLength(x.ids.length);
    expect(x.stress[4]).toBe(1);
  });
  it('handles Turkish letters, punctuation and digit fallback without crashing',()=>{
    const x=zerrePhonemes('İki 2?',lexicon);
    expect(x.ids[0]).toBe(1);expect(x.ids.at(-1)).toBe(2);
    expect(x.ids).toContain(14);expect(x.ids).toContain(3);
    expect(x.ids.length).toBe(x.stress.length);
  });
});
