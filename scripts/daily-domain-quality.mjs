// Daily CI evidence: only counts, no test bodies or user data.
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
export const domains=[
 ['voice','Sesli sohbet ve ses motoru',/voice|speech|audio|zerre|piper|supertonic/i],
 ['models','Model ve NVIDIA altyapısı',/model|nim|nvidia|blueprint|provider/i],
 ['memory','Hafıza ve bağlam',/memory|context|retrieval|embedding/i],
 ['agents','Ajanlar ve araçlar',/agent|expert|tool|delegat|schedule/i],
 ['security','Güvenlik ve erişim',/auth|security|privacy|guard|permission|rate-limit|csrf|circuit/i],
 ['interface','Arayüz ve PWA',/pwa|welcome|ui-|shell|chat|workspace|navigation|release|stream/i],
 ['reliability','Platform ve güvenilirlik',/runtime|storage|database|daily|evolution|shutdown|health|telemetry/i]
];
export function summarize(report){
 const suites=Array.isArray(report?.testResults)?report.testResults:[];
 return domains.map(([id,label,pattern])=>{
   const matched=suites.filter(s=>typeof s.name==='string'&&pattern.test(s.name.split(/[\\/]/).at(-1)));
   const counts={passed:0,failed:0,other:0};
   for(const suite of matched)for(const a of Array.isArray(suite.assertionResults)?suite.assertionResults:[]){
     if(a.status==='passed')counts.passed++;else if(a.status==='failed')counts.failed++;else counts.other++;
   }
   return {id,label,files:matched.length,...counts,state:counts.failed||matched.some(s=>s.status==='failed')?'failed':counts.passed?'tested':'unmeasured'};
 });
}
if(process.argv.includes('--report')){
 let raw=null;try{raw=JSON.parse(readFileSync('hafize-vitest-results.json','utf8'));}catch{}
 const result={version:1,revision:process.env.GITHUB_SHA||null,generatedAt:new Date().toISOString(),source:'offline_ci',reportAvailable:Boolean(raw),domains:summarize(raw),liveInferenceTested:false,codeChanged:false};
 writeFileSync('hafize-domain-quality.json',JSON.stringify(result,null,2)+'\n');
 const lines=['## Hafize alan bazlı regresyon raporu','','Yalnız çevrimdışı otomatik test kanıtı; alanlar örtüşebilir. Canlı hizmet veya cevap doğruluğu garantisi değildir.','',...result.domains.map(d=>'- '+d.label+': '+d.state+' · '+d.files+' dosya · '+d.passed+' başarılı / '+d.failed+' başarısız / '+d.other+' diğer')];
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
 console.log(lines.join('\n'));
 if(!raw)process.exitCode=1;
}
