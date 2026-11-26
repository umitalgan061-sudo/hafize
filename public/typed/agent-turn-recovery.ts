export type ToolActivity={label:string;state:'running'|'success'|'failure';tool?:string;error?:string};
const legacyGroups:readonly (readonly string[])[]=[["fs_read","Workspace dosyası okunuyor","Workspace dosyası okundu","Workspace dosyası okunamadı"],["runtime_status","Runtime durumu kontrol ediliyor","Runtime durumu kontrol edildi","Runtime durumu kontrol edilemedi"],["agent_delegate","Uzman ajan çalıştırılıyor","Uzman ajan çalıştırıldı","Uzman ajan çalıştırılamadı"],["github_read_file","GitHub dosyası okunuyor","GitHub dosyası okundu","GitHub dosyası okunamadı"],["github_inspect","GitHub durumu doğrulanıyor","GitHub durumu okundu","GitHub durumu okunamadı"],["github_develop","İzinli GitHub geliştirme adımı hazırlanıyor","GitHub geliştirme adımı tamamlandı","GitHub geliştirme adımı uygulanmadı"],["canva_read","Canva verisi okunuyor","Canva verisi okundu","Canva verisi okunamadı"],["gmail_read","Gmail verisi okunuyor","Gmail verisi okundu","Gmail verisi okunamadı"],["weather_forecast","Hava durumu alınıyor","Hava durumu alındı","Hava durumu alınamadı"],["memory_save","Hafızaya kaydediliyor","Hafızaya kaydedildi","Hafızaya kaydedilemedi"],["memory_forget","Hafızadan siliniyor","Hafızadan silindi","Hafızadan silinemedi"],["research_run","Hafızada aranıyor","Hafızada arandı","Hafızada aranamadı"],["memory_consolidate","Sohbet hafızaya özetleniyor","Sohbet hafızaya kaydedildi","Sohbet hafızaya kaydedilemedi"],["expert_find","Yerel sunucu başlatılıyor","Yerel sunucu başlatıldı","Yerel sunucu başlatılamadı"],["localhost_list","Yerel sunucular listeleniyor","Yerel sunucular listelendi","Yerel sunucular listelenemedi"],["localhost_stop","Yerel sunucu durduruluyor","Yerel sunucu durduruldu","Yerel sunucu durdurulamadı"],["skill_invoke","Hafize skill’i hazırlanıyor","Hafize skill’i hazırlandı","Hafize skill’i hazırlanamadı"],["test_run","Testler çalıştırılıyor","Testler tamamlandı","Testler çalıştırılamadı"],["test_read_result","Test sonucu okunuyor","Test sonucu okundu","Test sonucu okunamadı"],["git_run","Git komutu çalıştırılıyor","Git komutu tamamlandı","Git komutu başarısız"],["github_development","GitHub geliştirme adımı için onay bekleniyor","GitHub geliştirme adımı tamamlandı","GitHub geliştirme adımı tamamlanamadı"],["rule_create","Kural kaydediliyor","Kural kaydedildi","Kural kaydedilemedi"],["rule_list","Kurallar listeleniyor","Kurallar listelendi","Kurallar listelenemedi"],["rule_remove","Kural siliniyor","Kural silindi","Kural silinemedi"],["rule_set_enabled","Kural güncelleniyor","Kural güncellendi","Kural güncellenemedi"],["skill_create","Yeni skill kaydediliyor","Skill kaydedildi","Skill kaydedilemedi"]];
const legacy=new Map(legacyGroups.flatMap(([id,...labels])=>labels.map(label=>[label,id!] as const)));
export const CLOUD_WAIT_TEXT='Yanıtın hazırlanıyor, birazdan buraya yazılacak.';
export const INTERRUPTED_TEXT='İşlem tamamlanamadı veya bağlantı kesildi. Yukarıdaki araç sonuçları kısmi çalışmayı gösterir. GitHub değişikliği yaptıysan yeniden denemeden önce dalı ve PR durumunu kontrol et.';
export function normalizeToolActivity(value:unknown):ToolActivity|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Record<string,unknown>;
 if(typeof v.label!=='string')return null;
 const label=v.label.trim().replace(/\s+(?:[x×]\s*\d+)$/iu,'').slice(0,80);
 if(!label)return null;
 const state=v.state==='running'?'running':typeof v.ok==='boolean'?(v.ok?'success':'failure'):v.state;
 if(state!=='running'&&state!=='success'&&state!=='failure')return null;
 const tool=typeof v.tool==='string'&&/^[a-z0-9_-]{1,100}$/i.test(v.tool)?v.tool:legacy.get(label.replace(/ — kesildi$/u,''));
 const error=state==='failure'&&typeof v.error==='string'&&/^[A-Z][A-Z0-9_]{1,99}$/.test(v.error)?v.error:undefined;
 return {label,state,...(tool?{tool}:{}),...(error?{error}:{})};
}
export function compactToolActivities(values:unknown,max=40):ToolActivity[]{
 if(!Array.isArray(values))return [];
 const byTool=new Map<string,ToolActivity>();
 for(const raw of values){const next=normalizeToolActivity(raw);if(!next)continue;
  const key=next.tool||next.label;byTool.delete(key);byTool.set(key,next);
 }
 return [...byTool.values()].slice(-max);
}
export function settleToolActivities(values:unknown):ToolActivity[]{
 return compactToolActivities(values).map(a=>a.state==='running'?{...a,state:'failure',label:a.label+' — kesildi',error:'RUN_INTERRUPTED'}:a);
}
export function recoverCloudWait(content:string,confirmedPending:boolean):string{
 return content===CLOUD_WAIT_TEXT&&!confirmedPending?INTERRUPTED_TEXT:content;
}
export function isCloudWait(content:unknown):boolean{return content===CLOUD_WAIT_TEXT;}

/** A client-created ID is not a confirmed server checkpoint. A missing
 * checkpoint cannot establish that no external mutation occurred. */
export function agentStreamFailure(error:unknown,confirmed:boolean):string{
 const e=error&&typeof error==='object'?error as {code?:unknown;status?:unknown}:{};
 const code=typeof e.code==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(e.code)?e.code:'STREAM_INTERRUPTED';
 const status=typeof e.status==='number'&&Number.isInteger(e.status)&&e.status>=400&&e.status<=599?' (HTTP '+e.status+')':'';
 return 'Görev yanıtı kesildi: '+code+status+'. '+(confirmed?'Daha önce doğrulanan sunucu kaydı kontrol edilecek.':'Sunucu görev kaydını henüz doğrulamadı; kayıt durumu kontrol edilecek.');
}
export function missingCheckpointAnswer(content:string,confirmed:boolean):string{
 const previous=typeof content==='string'?content.trim():'';
 const note=confirmed?'Daha önce doğrulanan görev kaydı artık bulunamıyor. Sunucu yeniden başlatılmış veya kayıt kaybolmuş olabilir.':'Sunucuda bu görev kimliği için kayıt bulunamadı; kayıt oluşturulduğu doğrulanmamıştı.';
 const details=previous&&previous!=='Görev sunucuya gönderiliyor…'&&previous!==CLOUD_WAIT_TEXT?previous+'\n\n':'';
 return details+note+' GitHub dalı ve PR durumunu doğrulamadan yazma işlemini yeniden çalıştırma.';
}

/** Browser-only display evidence from the authenticated task stream, not a
 * replay token, server authorization, or proof that a task is complete. */
export function checkpointEvidence(value:unknown):string{
 return typeof value==='string'?value.trim().slice(0,32000):'';
}
export function withCheckpointEvidence(content:string,value:unknown):string{
 const evidence=checkpointEvidence(value);
 if(!evidence||content.includes(evidence))return content;
 return content+'\n\nTarayıcıya ulaşan son sunucu kanıtları (yeni işlem yapılmadı):\n\n'+evidence;
}

/** Opaque server-encrypted backup; never include in model message text. */
export function recoveryCapsule(value:unknown):string{return typeof value==='string'&&value.length<=64000&&/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)?value:'';}
