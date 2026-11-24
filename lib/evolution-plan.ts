import type {ExpertReadiness} from './expert-readiness.ts';
import type {RuntimeEvidence} from './model-runtime-evidence.ts';
export type EvolutionTask={id:string;priority:'high'|'normal';area:string;title:string;evidence:string;acceptance:string};
export type EvolutionPlan={mode:'recommendation_only';focus:string;tasks:EvolutionTask[];generatedAt:string};
const week=['Haftalık regresyon ve kalite','Model değerlendirme','Uzman görev performansı','Sesli sohbet ve kamera','Hafıza ve geri bildirim','Araçlar ve uzman ajanlar','Kod kalitesi ve güvenlik'];
export function buildEvolutionPlan(input:{now:number;readiness?:ExpertReadiness[];runtime?:RuntimeEvidence[];catalogChanges?:{addedCount:number;added:string[]}|null;pendingModels?:readonly string[];liveProbes:boolean;labAvailable:boolean|null;error:string|null}):EvolutionPlan{
 const tasks:EvolutionTask[]=[];
 const add=(id:string,priority:EvolutionTask['priority'],area:string,title:string,evidence:string,acceptance:string)=>tasks.push({id,priority,area,title,evidence,acceptance});
 if(input.labAvailable===false)add('model-lab-access','high','models','Model Laboratuvarı bağlantısını doğrula','Doğrudan NVIDIA laboratuvarı kullanılabilir değil.','Sahip oturumu ile katalog durumu doğrulansın; anahtar veya ücretli servis değiştirilmesin.');
 for(const row of input.readiness??[])if(!row.passed)add('expert:'+row.agentId,'high','experts','Uzman sözleşmesini incele: '+row.agentId,row.checks.filter(c=>!c.passed).map(c=>c.key).join(', ').slice(0,300),'Eksik kontrol için regresyon testi ekle; araç yetkilerini genişletme.');
 for(const row of input.runtime??[])if(row.attempts>=8&&(row.failures+Math.min(row.streamFailures,row.headersOk))/row.attempts>=0.25)add('reliability:'+row.model,'high','models','Model bağlantı hatalarını incele: '+row.model,row.attempts+' deneme; '+row.failures+' sağlayıcı ve '+row.streamFailures+' akış hatası.','Hata nedeni ve geri dönüş davranışı test edilsin; erişim başarısı kalite kanıtı sayılmasın.');
 if(input.catalogChanges?.addedCount)add('catalog-review','normal','models','Yeni model adaylarını incele',input.catalogChanges.addedCount+' yeni katalog kimliği.','Model türü, resmi erişim ve fiyat koşulları doğrulansın; otomatik aday ekleme yapılmasın.');
 if(input.pendingModels?.length)add('benchmark-pending','normal','models','Ölçümü güncel olmayan modelleri değerlendir',input.pendingModels.length+' aday güncel kanıt bekliyor.','Yalnız izinli modeller ve mevcut istek bütçesi; canlı test kapalıysa hazırlık raporu.');
 if(input.error)add('cycle-error','high','quality','Günlük döngü hatasını incele',input.error,'Yeniden üretilebilir test ve düzeltme önerisi; tamamlanmamış işi başarılı sayma.');
 add('blueprint-review','normal','quality','NVIDIA Blueprint entegrasyonlarını değerlendir','36 katalog kaydı; yerel uyarlama, mevcut özellik ve eksik altyapı ayrıdır.','Bir uygun Blueprint için küçük işlev veya test geliştir; ücretli/GPU dağıtımı başlatma ve kurulmamış servisi aktif gösterme.');
 const day=new Date(input.now+3*3600000).getUTCDay();const focus=week[day]!;
 add('weekly-focus:'+day,'normal','quality',focus,'Türkiye saatine göre haftalık odak.','Küçük, geri alınabilir değişiklik öner; kabul ölçütü ve regresyon testi belirle.');
 return {mode:'recommendation_only',focus,tasks:tasks.sort((a,b)=>Number(b.priority==='high')-Number(a.priority==='high')).slice(0,20),generatedAt:new Date(input.now).toISOString()};
}
