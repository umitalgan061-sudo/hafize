// "Uygulamayı yükle" and "Yerel sunucular" on the Settings page, plus the entry points the installed
// app gets from its manifest: shortcuts (?action=new, ?action=voice) and the share sheet (?text=).
import qrcode from 'qrcode-generator';

export interface LocalServer { readonly id: string; readonly name: string; readonly url: string; readonly status: string; readonly kind: string; readonly path: string; readonly command: string }
type InstallPrompt = Event & { prompt: () => Promise<unknown>; userChoice?: Promise<{ outcome: string }> };

const SERVER_POLL_MS = 20_000;

export type DeviceKind = 'installed' | 'ios' | 'android' | 'desktop';

export function deviceKind({ standalone, userAgent, maxTouchPoints = 0 }: { readonly standalone: boolean; readonly userAgent: string; readonly maxTouchPoints?: number }): DeviceKind {
  if (standalone) return 'installed';
  // iPadOS reports a Mac user agent, but a Mac has no touch screen.
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

/** Text carried in by the share sheet, or null when the app was opened normally. */
export function sharedText(search: string): string | null {
  const params = new URLSearchParams(search);
  const text = [params.get('title'), params.get('text'), params.get('url')].map((part) => part?.trim()).filter(Boolean).join('\n');
  return text ? text.slice(0, 20_000) : null;
}

export function qrSvg(text: string): string {
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  return code.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
}

function start(documentRef: Document, root: typeof globalThis): void {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const api = (path: string, init?: RequestInit) => ((root as typeof globalThis & { HafizeAuth?: { fetch: typeof fetch } }).HafizeAuth?.fetch ?? root.fetch.bind(root))(path, init);

  let installPrompt: InstallPrompt | null = null;
  let renderDevice: () => void = () => {};
  root.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event as InstallPrompt; renderDevice(); });
  root.addEventListener('appinstalled', () => { installPrompt = null; renderDevice(); });

  const installPanel = () => {
    const panel = el('section', 'settings-panel app-install');
    panel.append(el('h2', '', 'Uygulamayı yükle'), el('p', '', 'Hafize kendi penceresinde, tarayıcı çubuğu olmadan açılır.'));
    const device = el('div', 'app-install-device');
    const phone = el('div', 'app-install-phone');
    panel.append(device, phone);

    renderDevice = () => {
      const standalone = root.matchMedia?.('(display-mode: standalone)').matches || (root.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const kind = deviceKind({ standalone, userAgent: root.navigator.userAgent, maxTouchPoints: root.navigator.maxTouchPoints });
      device.replaceChildren();
      if (kind === 'installed') { device.append(el('p', 'app-install-state', 'Hafize bu cihazda uygulama olarak açık.')); return; }
      if (!root.isSecureContext) { device.append(el('p', 'app-install-state', 'Bu adres güvenli değil, tarayıcı yüklemeye izin vermez. Aşağıdaki HTTPS adresini kullan.')); return; }
      if (installPrompt) {
        const install = el('button', 'app-install-primary', 'Bu cihaza yükle');
        install.type = 'button';
        install.addEventListener('click', () => {
          const prompt = installPrompt;
          installPrompt = null;
          void prompt?.prompt().catch(() => {}).finally(renderDevice);
        });
        device.append(install);
        return;
      }
      device.append(el('p', 'app-install-state', kind === 'ios'
        ? 'iPhone ve iPad’de Safari’nin Paylaş menüsünden “Ana Ekrana Ekle”yi seç.'
        : kind === 'android'
          ? 'Chrome menüsünden “Uygulamayı yükle”yi seç.'
          : 'Adres çubuğundaki yükleme simgesini ya da tarayıcı menüsündeki “Uygulama olarak yükle”yi kullan.'));
    };

    void api('/api/install-info').then((response) => (response.ok ? response.json() : null)).then((info) => {
      phone.replaceChildren(el('h3', '', 'Telefona yükle'));
      const urls: string[] = Array.isArray(info?.https?.urls) ? info.https.urls : [];
      if (!urls.length) {
        phone.append(el('p', 'app-install-state', 'Telefon erişimi kapalı. Açmak için .env dosyasına HAFIZE_HTTPS_PORT=4443 ekleyip sunucuyu yeniden başlat.'));
        return;
      }
      for (const url of urls) {
        const row = el('div', 'app-install-qr');
        const code = el('div', 'app-install-code');
        code.setAttribute('role', 'img');
        code.setAttribute('aria-label', `${url} adresinin karekodu`);
        code.innerHTML = qrSvg(url); // Generated locally from a URL the server reported; no user markup.
        const text = el('div', 'app-install-qr-text');
        text.append(el('strong', '', url));
        const steps = el('ol');
        steps.append(
          el('li', '', 'Telefon bu bilgisayarla aynı ağda olsun, karekodu okut. İlk açılışta çıkan güvenlik uyarısında “Gelişmiş > Devam et”i seç.'),
          (() => { const li = el('li'); li.append('Sertifikayı indirip kur: '); const link = el('a', '', 'hafize-ca.crt'); link.href = `${new URL(url).origin}/hafize-ca.crt`; li.append(link, '. Android: Ayarlar > Güvenlik > Sertifika yükle > CA. iPhone: Ayarlar > İndirilen Profil, ardından Genel > Hakkında > Sertifika Güven Ayarları.'); return li; })(),
          el('li', '', 'Sayfayı yenile, erişim anahtarınla giriş yap ve tarayıcı menüsünden “Uygulamayı yükle / Ana Ekrana Ekle”yi seç.')
        );
        text.append(steps);
        row.append(code, text);
        phone.append(row);
      }
      phone.append(el('p', 'task-note', 'Sertifika yalnızca yerel ağ adresleri için geçerlidir, başka siteleri etkilemez. Bilgisayar açık ve Hafize çalışır durumda olmalı. Bağlanamazsan Windows Güvenlik Duvarı’nda 4443 portuna izin ver.'));
    }).catch(() => {});

    renderDevice();
    return panel;
  };

  const serversPanel = () => {
    const panel = el('section', 'settings-panel local-servers');
    panel.append(el('h2', '', 'Yerel sunucular'), el('p', '', 'Hafize’nin bu bilgisayarda başlattığı siteler ve uygulamalar. Sayı sınırı yok; sohbette “bu klasörü localhost’ta aç” demen yeterli.'));
    const list = el('ul', 'settings-memory-list local-server-list');
    panel.append(list);
    const refresh = async () => {
      let servers: LocalServer[] = [];
      try {
        const response = await api('/api/localhost');
        if (!response.ok) return;
        const data = await response.json();
        servers = Array.isArray(data?.servers) ? data.servers : [];
      } catch { return; }
      list.replaceChildren();
      if (!servers.length) { list.append(el('li', 'settings-memory-empty', 'Şu an çalışan yerel sunucu yok.')); return; }
      for (const server of servers) {
        const running = server.status === 'running';
        const item = el('li', running ? 'local-server' : 'local-server is-stopped');
        const head = el('div', 'local-server-head');
        head.append(el('strong', '', server.name));
        if (running && server.url) {
          const link = el('a', '', server.url);
          link.href = server.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          head.append(link);
        } else head.append(el('small', '', server.status === 'starting' ? 'Başlıyor…' : 'Durdu'));
        const action = el('button', '', running || server.status === 'starting' ? 'Durdur' : 'Kaldır');
        action.type = 'button';
        action.setAttribute('aria-label', `${server.name}: ${action.textContent}`);
        action.addEventListener('click', () => { void api(`/api/localhost/${encodeURIComponent(server.id)}/stop`, { method: 'POST' }).finally(refresh); });
        item.append(head, action);
        list.append(item);
      }
    };
    void refresh();
    setInterval(() => { if (panel.isConnected && panel.offsetParent !== null) void refresh(); }, SERVER_POLL_MS);
    return panel;
  };

  const modelPanel = () => {
    const panel = el('section', 'settings-panel model-status');
    panel.append(el('h2', '', 'Yapay zekâ ve bağlantı'), el('p', '', 'Hafize göreve uygun ölçülmüş modelleri önceliklendirir. Model yanıt veremez veya kullanım sınırına ulaşırsa yedek zincire geçer.'));
    const line = el('p', 'app-install-state');
    const list = el('ol', 'model-status-list');
    panel.append(line, list);
    const reasons: Readonly<Record<string, string>> = { quota: 'paket doldu', rate: 'sınıra takıldı', missing: 'erişilemiyor', failing: 'hata veriyor', slow: 'yavaş kaldı' };
    const refresh = async () => {
      try {
        const response = await api('/api/models/status');
        if (!response.ok) return;
        const data = await response.json();
        line.textContent = data.internet ? 'İnternet bağlantısı var: arama, haber, hava durumu ve sayfa okuma açık.' : 'Bu bilgisayar şu an internete ulaşamıyor; web araçları bağlantı gelince yeniden çalışır.';
        list.replaceChildren(...[...(data.chain ?? []), ...(data.extraCandidates ?? [])].map((item: { model: string; ready: boolean; lastFailure: string | null; retryInSeconds: number }) => {
          const row = el('li', [item.model === data.current ? 'is-current' : '', item.ready ? '' : 'is-resting'].filter(Boolean).join(' '));
          const note = item.ready ? (item.model === data.current ? 'kullanılıyor' : '') : `${reasons[item.lastFailure ?? ''] ?? 'dinleniyor'}, ${Math.max(1, Math.ceil(item.retryInSeconds / 60))} dk sonra yeniden denenecek`;
          row.append(el('span', 'model-status-dot'), el('span', 'model-status-name', item.model), el('small', '', note));
          return row;
        }));
      } catch { /* the panel simply keeps its last state */ }
    };
    void refresh();
    setInterval(() => { if (panel.isConnected && panel.offsetParent !== null) void refresh(); }, SERVER_POLL_MS);
    return panel;
  };

  const modelLabPanel = () => {
    const panel=el('section','settings-panel model-lab-panel');
    panel.append(el('h2','','NVIDIA Model Laboratuvarı'),el('p','','Katalog, sentetik testler ve görev bazlı sıralama. Katalogdaki modellerin fiyatı ve erişimi doğrulanmış değildir. Testler ortak istek bütçesini kullanır.'));
    const notice=el('p','app-install-state','Henüz sorgulanmadı.');
    notice.setAttribute('role','status');
    const filter=el('input');
    filter.type='search'; filter.placeholder='Model veya yetenek ara'; filter.setAttribute('aria-label','Model veya yetenek ara');
    const select=el('select');select.setAttribute('aria-label','Test edilecek model');
    const actions=el('div','settings-actions');
    const leaders=el('ul','settings-memory-list');
    const daily=el('p','app-install-state');
    const dailyHistory=el('ul','settings-memory-list');
    const dailyDetails=el('details');dailyDetails.append(el('summary','','Son 14 iyileştirme döngüsü'),dailyHistory);
    const list=el('ul','model-status-list');
    const details=el('details');details.append(el('summary','','Model kataloğu ve test sonuçları'),filter,list);
    const runtimeList=el('ul','settings-memory-list');const runtimeDetails=el('details');runtimeDetails.append(el('summary','','Son günlük çalışma zamanı ölçümleri'),el('p','','Bağlantı ve yanıt başlığı ölçümleri; yanıt doğruluğu testi değildir.'),runtimeList);
    panel.append(notice,actions,select,daily,dailyDetails,runtimeDetails,leaders,details);
    type Row={id:string;capabilities:string[];configured:boolean;listed:boolean;evidence:string};
    type LabData={dailyImprovement?:{enabled:boolean;liveProbes:boolean;nextDueAt:string|null;history?:{startedAt:string;state:string;testedModels:number;deepTestedModels?:number;specialists:number;changes?:{kind:string;before:string|null;after:string|null}[]}[];report?:{state:string;finishedAt:string|null;experts:unknown[];runtimeEvidence?:{model:string;attempts:number;headersOk:number;failures:number;streamFailures:number;meanHeaderMs:number|null}[];taskLeaders?:Record<string,string[]>}};inventory?:Row[];eligible?:string[];specialists?:string[];requestsRemaining?:number;blockedUntil?:string;running?:boolean;taskLeaders?:Record<string,string[]>;results?:{model:string;chatLatencyMs:number|null;tools:boolean}[];specialistResults?:{model:string;status:string;dimension:number|null}[]};
    let data:LabData={};let busy=false;let available=false;
    const buttons:HTMLButtonElement[]=[];
    const render=()=>{
      const search=filter.value.toLocaleLowerCase('tr-TR');
      list.replaceChildren();
      for(const row of (Array.isArray(data.inventory)?data.inventory:[]).filter(row=>(row.id+' '+row.capabilities.join(' ')).toLocaleLowerCase('tr-TR').includes(search)).slice(0,530)){
        const item=el('li');
        const measured=data.results?.find(result=>result.model===row.id);
        item.append(el('span','model-status-name',row.id),el('small','',row.capabilities.join(', ')+' · '+(row.configured?'aday':'sadece katalog')+' · '+row.evidence+(measured?' · '+(measured.chatLatencyMs??'—')+' ms':'')));
        list.append(item);
      }
      leaders.replaceChildren();
      const cycle=data.dailyImprovement;
      daily.textContent=cycle?'24 saatlik iyileştirme: '+(cycle.enabled?'etkin':'kapalı')+' · Canlı sentetik test: '+(cycle.liveProbes?'etkin':'kapalı')+' · Son durum: '+(cycle.report?.state??'henüz yok')+(cycle.nextDueAt?' · Sonraki uygun zaman: '+new Date(cycle.nextDueAt).toLocaleString('tr-TR'):''):'Günlük iyileştirme durumu bilinmiyor.';
      dailyHistory.replaceChildren();
      for(const row of (cycle?.history??[]).slice(0,14)){
        const entry=el('li','',new Date(row.startedAt).toLocaleString('tr-TR')+' · '+row.state+' · Sohbet '+row.testedModels+' · Derin '+(row.deepTestedModels??0)+' · Uzman '+row.specialists);
        for(const change of row.changes??[])entry.append(el('small','',change.kind+': '+(change.before??'—')+' → '+(change.after??'—')));
        dailyHistory.append(entry);
      }
      if(!dailyHistory.children.length)dailyHistory.append(el('li','','Henüz tamamlanan günlük döngü yok.'));
      runtimeList.replaceChildren();
      for(const row of cycle?.report?.runtimeEvidence??[]){const entry=el('li','',row.model);entry.append(el('small','',row.attempts+' deneme · '+row.headersOk+' başarılı başlık · '+row.failures+' sağlayıcı hatası · '+row.streamFailures+' akış hatası · '+(row.meanHeaderMs??'—')+' ms ortalama başlık'));runtimeList.append(entry);}
      if(!runtimeList.children.length)runtimeList.append(el('li','','Henüz günlük raporda çalışma zamanı örneği yok.'));
      for(const [kind,ids] of Object.entries(data.taskLeaders??{}))leaders.append(el('li','',kind+': '+(ids[0]||'ölçülmedi')));
      for(const [kind,ids] of Object.entries(cycle?.report?.taskLeaders??{}))if(ids[0]&&ids[0]!==data.taskLeaders?.[kind]?.[0])leaders.append(el('li','','Son günlük uyarlama · '+kind+': '+ids[0]));
      for(const row of data.specialistResults??[])leaders.append(el('li','',row.model+': '+row.status+' · '+(row.dimension??'—')+' boyut'));
      const selected=select.value;
      select.replaceChildren(...[...new Set([...(data.eligible??[]),...(data.specialists??[])])].map(id=>{const option=el('option','',id);option.value=id;return option;}));
      if([...select.options].some(option=>option.value===selected))select.value=selected;
    };
    function controls(){for(const button of buttons)button.disabled=busy||(!available&&button.dataset.action!=='status');select.disabled=busy;}
    async function run(action:string){
      if(busy)return;
      busy=true;controls();notice.textContent='İşlem yapılıyor…';
      try{
        const selected=select.value;
        const payload=['probe','deep','specialist'].includes(action)?{action,model:selected}:{action};
        if(action==='status'){
          const dailyResponse=await api('/api/models/status/daily').catch(()=>null);
          if(dailyResponse?.ok){data={...data,dailyImprovement:await dailyResponse.json()};render();}
        }
        const response=await api('/api/models/status/lab',action==='status'?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const result=await response.json();
        if(!response.ok){if(response.status===401||response.status===403||response.status===503){available=false;data={dailyImprovement:response.status===503?data.dailyImprovement:undefined};render();}throw Error(typeof result.error==='string'?result.error:'MODEL_LAB_HTTP_ERROR');}
        data={...result,dailyImprovement:result.dailyImprovement??data.dailyImprovement};available=true;render();
        notice.textContent='Kalan test isteği: '+String(data.requestsRemaining??'—')+(data.blockedUntil?' · Sağlayıcı bekleme süresi var.':'')+(data.running?' · Başka test devam ediyor.':'');
      }catch(error){notice.textContent='Model Laboratuvarı: '+(error instanceof Error?error.message:'Bağlantı hatası');}
      finally{busy=false;controls();}
    }
    for(const [action,label] of [['status','Durumu yenile'],['discover','Kataloğu getir'],['batch','Sıradaki testler'],['probe','Sohbet testi'],['deep','Derin test'],['specialist','Embedding testi']]){
      const button=el('button','',label);button.type='button';button.dataset.action=action;button.addEventListener('click',()=>{void run(action!);});buttons.push(button);actions.append(button);
    }
    filter.addEventListener('input',render);
    controls(); // No automatic provider calls; the owner initiates refresh and every test.
    return panel;
  };

  const specialistPanel = () => {
    const panel=el('section','settings-panel nim-specialist-panel');
    panel.append(el('h2','','NVIDIA Uzman Servisleri'),el('p','','Yalnız yapılandırılmış NIM servislerine, seçtiğin dosya veya metin açıkça gönderilir. Mevcut Türkçe sesli sohbet ayarları değişmez.'));
    const notice=el('p','app-install-state','Servis durumunu yenile.');notice.setAttribute('role','status');
    const refresh=el('button','','Servis durumunu yenile');refresh.type='button';
    const operation=el('select');operation.setAttribute('aria-label','Uzman işlemi');
    const language=el('select');language.setAttribute('aria-label','Servis dili');
    const file=el('input');file.type='file';file.setAttribute('aria-label','Uzman servisine gönderilecek dosya');
    const input=el('textarea');input.maxLength=2000;input.rows=3;input.placeholder='Seslendirilecek metin';input.setAttribute('aria-label','Seslendirilecek metin');
    const execute=el('button','','İşlemi çalıştır');execute.type='button';
    const result=el('textarea');result.readOnly=true;result.rows=6;result.setAttribute('aria-label','Uzman servis sonucu');result.hidden=true;
    const audio=el('audio');audio.controls=true;audio.hidden=true;
    const clear=el('button','','Temizle');clear.type='button';
    const cancel=el('button','','İptal');cancel.type='button';cancel.disabled=true;
    const actions=el('div','settings-actions');actions.append(refresh,execute,cancel,clear);
    const health=el('ul','settings-memory-list');
    panel.append(notice,health,operation,language,file,input,actions,result,audio);
    type Status={asr:boolean;tts:boolean;parse:boolean;asrLanguages:string[];ttsLanguages:string[];observations?:Record<string,{state:string;lastCheckedAt:string|null;latencyMs:number|null;error:string|null}>};
    let status:Status|null=null;let controller:AbortController|null=null;let audioUrl:string|null=null;let busy=false;
    const release=()=>{audio.pause();audio.removeAttribute('src');if(audioUrl)root.URL.revokeObjectURL(audioUrl);audioUrl=null;audio.hidden=true;result.value='';result.hidden=true;};
    function render(){
      const op=operation.value;
      language.hidden=op==='parse'||!op;input.hidden=op!=='synthesize';file.hidden=op==='synthesize'||!op;
      file.accept=op==='parse'?'image/png,image/jpeg':'audio/wav,.wav';
      const old=language.value;language.replaceChildren();
      for(const code of (op==='transcribe'?status?.asrLanguages:op==='synthesize'?status?.ttsLanguages:[])??[]){const option=el('option','',code);option.value=code;language.append(option);}
      if([...language.options].some(o=>o.value===old))language.value=old;
      execute.disabled=busy||!op;refresh.disabled=busy;operation.disabled=busy;language.disabled=busy;input.disabled=busy;file.disabled=busy;clear.disabled=busy;cancel.disabled=!controller;
    }
    async function refreshStatus(){
      busy=true;render();
      try{
        const response=await api('/api/nim-specialists');if(!response.ok)throw Error('NIM_STATUS_UNAVAILABLE');status=await response.json();
        const selected=operation.value;operation.replaceChildren();
        for(const [key,label,enabled] of [['transcribe','Sesi yazıya çevir',status?.asr],['synthesize','Metni seslendir',status?.tts],['parse','Belge sayfası / OCR',status?.parse]] as const){
          if(!enabled)continue;const option=el('option','',label);option.value=key;operation.append(option);
        }
        if([...operation.options].some(o=>o.value===selected))operation.value=selected;
        health.replaceChildren();
        for(const [key,label] of [['asr','ASR'],['tts','TTS'],['parse','Belge']]){
          const observation=status?.observations?.[key!];
          const configured=status?.[key as 'asr'|'tts'|'parse'];
          health.append(el('li','',label+': '+(!configured?'yapılandırılmadı':observation?.state==='passed'?'son istek başarılı':observation?.state==='failed'?'son istek başarısız':'henüz denenmedi')+(observation?.latencyMs!=null?' · '+observation.latencyMs+' ms':'')+(observation?.error?' · '+observation.error:'')));
        }
        notice.textContent=operation.options.length?'Yapılandırılmış servisler listelendi. Son istek sonuçları genel erişim garantisi değildir.':'Uzman NIM servisleri yapılandırılmamış. Mevcut sesli sohbet ve görsel analiz kullanılabilir.';
      }catch{status=null;operation.replaceChildren();health.replaceChildren();notice.textContent='Uzman servis durumu alınamadı.';}
      finally{busy=false;render();}
    }
    function encode(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return root.btoa(binary);}
    async function run(){
      if(busy||!operation.value)return;
      release();busy=true;const current=new AbortController();controller=current;render();notice.textContent='Uzman servis çalışıyor…';
      try{
        const op=operation.value;
        let payload:Record<string,unknown>={language:language.value};
        if(op==='synthesize'){if(!input.value.trim())throw Error('Metin gir.');payload.text=input.value;}
        else{const selected=file.files?.[0];if(!selected||selected.size>6*1024*1024)throw Error('En fazla 6 MB boyutunda dosya seç.');payload.data=encode(new Uint8Array(await selected.arrayBuffer()));}
        if(current.signal.aborted)return;
        const response=await api('/api/nim-specialists/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:current.signal});
        const value=await response.json();if(!response.ok)throw Error(typeof value.error==='string'?value.error:'NIM_REQUEST_FAILED');
        if(current.signal.aborted)return;
        if(op==='synthesize'){if(value.mime!=='audio/wav'||typeof value.data!=='string')throw Error('Ses yanıtı geçersiz.');const bytes=Uint8Array.from(root.atob(value.data),c=>c.charCodeAt(0));audioUrl=root.URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));audio.src=audioUrl;audio.hidden=false;}
        else{result.value=String(op==='parse'?value.content??'':value.text??'');result.hidden=false;}
        notice.textContent=value.truncated?'İşlem tamamlandı, fakat belge çıktısı kesildi.':'Uzman servis yanıtı alındı. Sonucu kontrol et.';
      }catch(error){notice.textContent=current.signal.aborted?'İşlem iptal edildi.':(error instanceof Error?error.message:'Uzman servis hatası');}
      finally{controller=null;busy=false;render();}
    }
    refresh.addEventListener('click',()=>{void refreshStatus();});
    execute.addEventListener('click',()=>{void run();});
    cancel.addEventListener('click',()=>controller?.abort());
    clear.addEventListener('click',()=>{release();input.value='';file.value='';});
    operation.addEventListener('change',()=>{release();file.value='';render();});
    root.addEventListener('pagehide',()=>{controller?.abort();release();},{once:true});
    render();
    return panel;
  };

  const attach = (host: Element) => {
    if (host.querySelector('.app-install')) return;
    const first = host.querySelector('.settings-panel');
    if (first?.nextSibling) host.insertBefore(installPanel(), first.nextSibling); else host.append(installPanel());
    const install = host.querySelector('.app-install');
    if (install?.nextSibling) host.insertBefore(modelPanel(), install.nextSibling); else host.append(modelPanel());
    host.append(modelLabPanel(),specialistPanel());
    const results = host.querySelector('.task-results') ?? install;
    const servers = serversPanel();
    if (results?.nextSibling) host.insertBefore(servers, results.nextSibling); else host.append(servers);
  };
  const host = documentRef.querySelector('.settings-workspace');
  if (host) attach(host);
  else {
    // settings-workspace.ts builds its page while the app starts; watch once, then stop.
    const watcher = new root.MutationObserver(() => {
      const found = documentRef.querySelector('.settings-workspace');
      if (found) { watcher.disconnect(); attach(found); }
    });
    watcher.observe(documentRef.documentElement, { childList: true, subtree: true });
  }

  // Manifest entry points. Run once, after the app shell has had its chance to bind the buttons.
  root.setTimeout(() => {
    const params = new URLSearchParams(root.location.search);
    const action = params.get('action');
    if (action === 'new') documentRef.querySelector<HTMLElement>('#newChatBtn')?.click();
    if (action === 'voice') documentRef.querySelector<HTMLElement>('#micBtn')?.click();
    const shared = sharedText(root.location.search);
    const input = documentRef.querySelector<HTMLTextAreaElement>('#messageInput');
    if (shared && input) {
      input.value = shared;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
    if (root.location.search) root.history.replaceState(null, '', root.location.pathname);
  }, 400);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(document, globalThis), { once: true });
  else start(document, globalThis);
}
