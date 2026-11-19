const tools = [
  { title:'Deney kaydını doğrula', url:'/task-plan.html#experiment-file', words:['deney kaydı','deney kaydını','deneyi doğrula','deney json','deney sonucunu doğrula'] },
  { title:'Weight-Space laboratuvarını aç', url:'https://weight-space06.web.app/lab.html', words:['weight space','weight-space','ağırlık deneyi','öğrenme hızı','ağırlık laboratuvarı'] },
  { title:'CSV ve kod değişikliklerini incele', url:'/file-analysis.html', words:['csv','tsv','git diff','git yaması','patch dosyası','yamayı incele'] },
  { title:'Ses ve montaj stüdyosunu aç', url:'/studio.html', words:['seslendirme','altyazı','webvtt','srt','montaj stüdyosu'] },
  { title:'Görev planını denetle', url:'/task-plan.html', words:['görev planı','görev planını','adımlara böl','görev bağımlılığı','bağımlılık sırası'] }
];
function normalize(text:string) {
  return text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('ı','i').replace(/[^a-z0-9]+/g,' ').trim();
}
const indexed = tools.map(tool=>({...tool,terms:tool.words.map(normalize)}));
export function suggestTools(input:string) {
  if(input.trim()==='/araçlar' || input.trim()==='/araclar') return tools;
  const query=' '+normalize(input.slice(0,2000))+' ';
  return indexed.filter(tool=>tool.terms.some(term=>query.includes(' '+term+' ')));
}
