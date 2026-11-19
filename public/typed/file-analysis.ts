import {parseCsv,groupValues,inspectPatch} from '../../lib/file-analysis.ts';
const byId = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const select = (id:string) => byId<HTMLSelectElement>(id);
const source=byId<HTMLTextAreaElement>('source'), output=byId('output'), status=byId('status');
let rows:string[][]=[], draft='', revision=0;
function reset() {
  revision++; rows=[]; draft=''; output.replaceChildren(); status.textContent='';
  byId('chat').hidden=true; byId('grouping').hidden=true;
  byId('csv-controls').hidden=select('kind').value!=='csv';
}
function table(headers:string[],data:string[][]) {
  const t=document.createElement('table'), head=t.createTHead().insertRow(), body=t.createTBody();
  for(const title of headers){ const th=document.createElement('th'); th.textContent=title; head.append(th); }
  for(const r of data){const tr=body.insertRow();for(const v of r)tr.insertCell().textContent=v;}
  output.replaceChildren(t);
}
function run(fn:()=>void) {try{fn();}catch(e){status.textContent=e instanceof Error?e.message:'Dosya okunamadı.';}}
for(const id of ['source','kind','delimiter','decimal']) byId(id).addEventListener('input',reset);
byId('upload').addEventListener('change',async e=>{
  reset(); const token=revision,file=(e.target as HTMLInputElement).files?.[0]; if(!file)return;
  if(file.size>2_000_000){status.textContent='En fazla 2 MB dosya seç.';return;}
  try {const text=await file.text(); if(token!==revision)return;source.value=text;
    if(/\.(diff|patch)$/i.test(file.name))select('kind').value='diff';
    if(/\.(csv|tsv)$/i.test(file.name))select('kind').value='csv';
    if(/\.tsv$/i.test(file.name))select('delimiter').value='tab';
    reset();
  }catch{if(token===revision)status.textContent='Dosya okunamadı.';}
});
byId('analyze').onclick=()=>run(()=>{
  reset();if(source.value.length>2_000_000)throw Error('Metin 2 MB sınırını aşıyor.');
  if(select('kind').value==='diff'){
    const files=inspectPatch(source.value);
    const data=files.slice(0,200).map(f=>[f.path,String(f.added),String(f.removed),f.notes.join('\n')]);
    table(['Dosya','Eklenen','Silinen','TODO / FIXME'],data);
    status.textContent=files.length+' dosya bölümü · '+data.length+' gösteriliyor.';
    draft='Bu yama özetine göre hangi dosyalar için hangi testleri önerirsin?\n'+JSON.stringify(data);
    byId('chat').hidden=false;return;
  }
  const sep=select('delimiter').value;
  rows=parseCsv(source.value,sep==='tab'?'\t':sep); const headers=rows[0]!;
  for(const id of ['key','metric']) select(id).replaceChildren(...headers.map((v,i)=>new Option(v||'Sütun '+(i+1),String(i))));
  select('metric').selectedIndex=Math.min(1,headers.length-1);byId('grouping').hidden=false;
  const preview=rows.slice(1,21);table(headers,preview);
  status.textContent=(rows.length-1)+' satır · '+headers.length+' sütun · '+preview.length+' satır önizleniyor.';
});
function calculate(){
  byId('chat').hidden=true;draft='';output.replaceChildren();
  const result=groupValues(rows,Number(select('key').value),Number(select('metric').value),select('decimal').value===',');
  const fmt=(v:number)=>v.toLocaleString('tr-TR',{maximumSignificantDigits:12});
  const data=result.groups.slice(0,200).map(([k,v])=>[k||'(boş)',String(v.count),fmt(v.total),fmt(v.total/v.count)]);
  table(['Grup','Sayısal kayıt','Toplam','Ortalama'],data);
  status.textContent=result.groups.length+' grup · '+data.length+' gösteriliyor · '+result.skipped+' boş veya sayısal olmayan kayıt atlandı.';
  draft='Bu CSV özetini yorumla. Gruplama: '+select('key').selectedOptions[0]?.text+', ölçü: '+select('metric').selectedOptions[0]?.text+'. '+status.textContent+'\n[Grup, kayıt, toplam, ortalama]\n'+JSON.stringify(data);
  byId('chat').hidden=data.length===0;
}
byId('calc').onclick=()=>run(calculate);
for(const id of ['key','metric'])select(id).onchange=()=>run(calculate);
byId('chat').onclick=()=>run(()=>{
  if(draft.length>16000)throw Error('Sohbet özeti çok uzun. Daha dar bir veri kümesi seç.');
  sessionStorage.setItem('hafize.analysis.draft',draft);location.assign('/#dosya-analizi');
});
