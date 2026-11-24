// Independent offline evaluation, no model API credentials, network or workspace writes.
import {loadAgentRegistry} from '../lib/agent-runtime.ts';
import {auditExpertContracts} from '../lib/expert-readiness.ts';
import {buildEvolutionPlan} from '../lib/evolution-plan.ts';
import {appendFileSync,writeFileSync} from 'node:fs';
const now=Date.now();
const experts=auditExpertContracts(await loadAgentRegistry());
const plan=buildEvolutionPlan({now,readiness:experts,liveProbes:false,labAvailable:null,error:null});
const report={version:1,mode:'offline_ci',generatedAt:new Date(now).toISOString(),revision:/^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:null,experts,plan,liveProviderTested:false,backendTested:false,codeChanged:false};
const lines=['# Hafize günlük çevrimdışı uzman denetimi','', 'Uzman sözleşmeleri: '+experts.filter(e=>e.passed).length+'/'+experts.length,'','Günlük odak: '+plan.focus,'','Canlı backend ve NVIDIA erişimi bu işte test edilmedi. Kaynak kodu değiştirilmedi.','',...experts.map(e=>'- '+e.agentId+': '+(e.passed?'başarılı':'kontrol gerekli')),'','## Önerilen işler',...plan.tasks.map(t=>'- '+t.title+' — '+t.acceptance),''];
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n'));
if(process.argv.includes('--report'))writeFileSync('hafize-evolution-report.json',JSON.stringify(report,null,2)+'\n',{flag:'w'});
console.log(lines.join('\n'));
if(experts.some(e=>!e.passed))process.exitCode=1;
