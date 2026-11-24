export function labStatusLabel(status: string):string {
 const labels:Record<string,string>={passed:'Yanıt / örnek testi başarılı',timeout:'Zaman aşımı — yanıt alınamadı',failed:'İstek başarısız',unavailable:'Uç nokta kullanılamıyor',rate_limited:'İstek sınırı',quota:'Kota / erişim reddi',invalid_response:'Yanıt biçimi veya örnek hatalı',auth_rejected:'API kimlik doğrulaması reddedildi',untested:'Henüz test edilmedi',not_run:'Test yapılmadı'};
 return labels[status]??status;
}
export function labErrorLabel(code:string):string {
 const labels:Record<string,string>={MODEL_LAB_MODEL_NOT_ALLOWED:'Bu model mevcut sunucunun test listesinde değil.',MODEL_LAB_OWNER_REQUIRED:'Model Laboratuvarı için hesap sahibi oturumu gerekli.',MODEL_LAB_UNAVAILABLE:'Sunucuda doğrudan NVIDIA bağlantısı yapılandırılmamış.',MODEL_LAB_PROVIDER_PAUSED:'NVIDIA bekleme süresinde. Daha sonra yeniden dene.',MODEL_LAB_BUDGET:'Test isteği sınırına ulaşıldı.',MODEL_LAB_BUSY:'Başka bir test çalışıyor.',MODEL_LAB_SMOKE_REQUIRED:'Önce başarılı sohbet testi gerekli.',AUTH_SESSION_FAILED:'Sunucu oturumu doğrulanamadı. Bağlantıyı kontrol et.',MODEL_LAB_HTTP_ERROR:'Sunucu yanıtı okunamadı.',MODEL_LAB_INVALID_TRANSLATION:'Çeviri için en fazla 1000 karakter ve desteklenen dil çifti gir.',MODEL_LAB_INVALID_SEARCH:'En fazla 8 paragraf, 1400 karakter ve kısa sorgu gir. Yalnız metin desteklenir.',MODEL_LAB_INVALID_EMBEDDING:'Embedding yanıtı geçerli değil.',MODEL_LAB_INVALID_TRANSLATION_RESPONSE:'Çeviri yanıtı geçerli değil.'};
 return labels[code]??'Bağlantı veya işlem hatası. Durumu yenileyerek tekrar dene.';
}
export function labCapabilityLabel(value:boolean|undefined,tested:boolean):string {return !tested||value===undefined?'Ölçülmedi':value?'Geçti':'Geçemedi';}
export function labLatency(ms:number|null|undefined):string {return typeof ms==='number'&&Number.isFinite(ms)&&ms>=0?(ms/1000).toLocaleString('tr-TR',{maximumFractionDigits:2})+' sn':'—';}
export function labTime(iso:string|undefined):string {return iso&&Number.isFinite(Date.parse(iso))?new Date(iso).toLocaleString('tr-TR'):'—';}
export function labActionAllowed(action:string,available:boolean,busy:boolean,selected:string,eligible:readonly string[],specialists:readonly string[],running:boolean,blocked:boolean,requests:number):boolean{
 if(busy)return false;if(action==='status')return true;if(!available||running||blocked||requests<=0)return false;
 if(action==='probe'||action==='deep')return eligible.includes(selected)&&requests>=2;
 if(action==='specialist')return specialists.includes(selected);
 if(action==='batch')return requests>=2;
 return true;
}
// Sanitized historical observations from actual Render deployment logs, not current health or routing evidence.
export const releaseVerification={date:'2026-11-24',source:'Render deployment logs (dep-dc2r3pss728c73bd87p0 and dep-dc2r1j68bjmc738gpvd0)',rows:[
 {name:'Kimi K3.1 Pro',status:'timeout',latencyMs:90093,detail:'Sohbet, Türkçe, kod ve araç yetenekleri ölçülemedi.'},
 {name:'Gemma 4 31B',status:'timeout',latencyMs:35005,detail:'Yanıt alınmadı.'},
 {name:'Nemotron Nano Omni',status:'passed',latencyMs:1524,detail:'Metin, mantık ve kod örneği başarılı; Türkçe kontrolü geçmedi, araç testi yapılmadı.'},
 {name:'Riva Translate 4B',status:'passed',latencyMs:682,detail:'İngilizce → Türkçe sentetik çeviri örneği başarılı.'},
 {name:'Nemotron 3.5 Embed 1B',status:'passed',latencyMs:376,detail:'2048 boyut; benzerlik kontrolü başarılı.'},
 {name:'Nemotron 3.5 Embed 8B',status:'passed',latencyMs:279,detail:'4096 boyut; benzerlik kontrolü başarılı.'}
]} as const;
