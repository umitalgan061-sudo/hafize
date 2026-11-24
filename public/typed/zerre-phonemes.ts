// Turkish lexicon-first frontend compatible with Zerre's documented token/stress inputs.
// Rule fallback derived from upstream's Apache-2.0 browser phonemizer; neutral voices only.
// https://github.com/erkinemreta1/zerre-tts/blob/cf3cdfaaa54a9e8ec541081bb5c2e97c3d563db4/web/public/phonemize-tr.js
type Lexicon={symbols:string[];words:Record<string,[string,string]>};
const letters:Record<string,string>={a:'a',b:'b',c:'dʒ',ç:'tʃ',d:'d',e:'e',f:'f',g:'g',h:'h',ı:'ɯ',i:'i',j:'ʒ',k:'k',l:'l',m:'m',n:'n',o:'o',ö:'œ',p:'p',r:'ɾ',s:'s',ş:'ʃ',t:'t',u:'u',ü:'y',v:'v',y:'j',z:'z'};
const vowels=new Set(['a','e','i','o','u','y','ø','œ','ɯ']);
const digits=['sıfır','bir','iki','üç','dört','beş','altı','yedi','sekiz','dokuz'];
export function zerrePhonemes(text:string,lexicon:Lexicon){
  const symbolIndex=new Map(lexicon.symbols.map((s,i)=>[s,i]));
  const ids:number[]=[],stress:number[]=[];
  const push=(p:string,level=0)=>{const id=symbolIndex.get(p);if(id!==undefined){ids.push(id);stress.push(level===1||level===2?level:0);}};
  push('<bos>');
  let previousWord=false;
  for(const token of text.normalize('NFC').replace(/\d/g,d=>' '+digits[Number(d)]+' ').match(/[\p{L}]+|[.,!?;:—…]/gu)||[]){
    if(!/^\p{L}/u.test(token)){push(token);previousWord=false;continue;}
    if(previousWord)push('<sp>');
    previousWord=true;const word=token.toLocaleLowerCase('tr-TR');
    if(Object.hasOwn(lexicon.words,word)){
      const [phones,levels]=lexicon.words[word]!;
      phones.split(' ').filter(Boolean).forEach((p,i)=>push(p,Number(levels[i])));
      continue;
    }
    const phones:string[]=[];
    for(const [i,ch] of [...word].entries()){
      if(ch==='ğ'){if(phones.length&&/[aeıioöuü]/.test(word[i-1]||''))phones[phones.length-1]+='ː';continue;}
      if(!Object.hasOwn(letters,ch))continue;
      let phone=letters[ch]!;
      if(ch==='k'&&/[eiöü]/.test(word[i+1]||''))phone='c';
      if(ch==='g'&&/[eiöü]/.test(word[i+1]||''))phone='ɟ';
      if(ch==='l'&&/[aıou]/.test(word[i-1]||''))phone='ɫ';
      phones.push(phone);
    }
    let accent=-1;
    for(let i=phones.length-1;i>=0;i--)if(vowels.has(phones[i]!.replace('ː',''))){accent=i;break;}
    phones.forEach((p,i)=>push(p,i===accent?1:0));
  }
  push('<eos>');
  return {ids,stress};
}
