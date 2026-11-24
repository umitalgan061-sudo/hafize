// Configuration evidence only: these flags are not a real scheduled execution probe.
const flags=[
 ['scheduleWorkerConfigured','Görev motoru','Sunucu görev yürütmeye yapılandırılmış.','Görev yürütme yapılandırması eksik.'],
 ['scheduleStorageDurable','Kalıcı görev deposu','Kalıcı depolama yapılandırılmış.','Yeniden başlatmada görevlerin korunması garanti değil.'],
 ['scheduleLeaseConfigured','Çift çalıştırma kilidi','Dağıtık kilit yapılandırılmış.','Dağıtık kilit doğrulanmadı.'],
 ['scheduleApiConfigured','Görev API','Görev API yapılandırılmış.','Görev API yapılandırması eksik.']
] as const;
export function summarizeScheduleRuntime(value:unknown){
 const data=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const signals=flags.map(([key,label,yes,no])=>{const v=data[key];return {key,label,state:v===true?'configured':v===false?'missing':'unknown',detail:v===true?yes:v===false?no:'Bu bilgi sunucudan alınamadı.'};});
 const state=signals[0]!.state==='missing'?'offline':signals[0]!.state==='unknown'?'unknown':signals.every(x=>x.state==='configured')?'configured':'partial';
 return {state,signals,summary:state==='configured'?'Tüm yapılandırma işaretleri mevcut. Gerçek görev çalıştırma ve 7/24 erişim ayrıca doğrulanmalıdır.':state==='partial'?'Görev motoru yapılandırılmış; bazı dayanıklılık bilgileri eksik.':state==='offline'?'Görev motorunun yapılandırması eksik.':'Görev motoru durumu doğrulanamadı.'};
}
