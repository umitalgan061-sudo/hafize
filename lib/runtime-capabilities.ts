import { OWNER_PROJECTS, matchOwnerProjects } from './owner-project-catalog.ts';
/** Server-owned execution facts. Never accept limits or permissions from a model/client. */
export const MAX_ROOT_CALLS_PER_ROUND = 8;
export const MAX_EXPERT_CALLS_PER_ROUND = 4;
export const LONG_RUN_LEDGER_ENTRIES = 8192;
export const MAX_EXPERT_ROUNDS = 24;

export interface RuntimeBudget {
  readonly maxToolRounds: number;
  readonly roundsStarted: number;
  readonly toolCallsCompleted: number;
  readonly timeoutMs: number | null;
  readonly elapsedMs: number;
  readonly expertMaxRounds: number | null;
  readonly maxCallsPerRound: number;
}

export function budgetSnapshot(input: RuntimeBudget) {
  return {
    ...input,
    roundsRemaining: Math.max(0, input.maxToolRounds - input.roundsStarted),
    remainingMs: input.timeoutMs === null ? null : Math.max(0, input.timeoutMs - input.elapsedMs),
    totalCallCeiling: input.maxToolRounds * input.maxCallsPerRound,
    completionGuaranteed: false
  };
}

export interface ToolInventoryEntry {
  readonly name: string;
  readonly state: 'available' | 'unavailable' | 'not_authorized' | 'approval_required';
}

export interface GitHubConnectionStatus {
  readonly readMode: 'app' | 'configured_credential' | 'public_read_only' | 'not_configured';
  readonly appConfigured: boolean;
  readonly readRepositories: readonly string[];
  readonly developmentRepositories: readonly string[];
  readonly developmentConfigured: boolean;
  readonly safeOwnerDevelopment: boolean;
  readonly interactiveApproval: boolean;
}

export function capabilitySnapshot(inventory: readonly ToolInventoryEntry[], budget: RuntimeBudget | null, agentCount: number, github: GitHubConnectionStatus | null = null) {
  const availableTools = inventory.filter(item => item.state === 'available').map(item => item.name);
  return {
    catalogSize: inventory.length,
    availableToolCount: availableTools.length,
    availableTools,
    unavailableTools: inventory.filter(item => item.state !== 'available'),
    agentCount,
    specialistCount: Math.max(0, agentCount - 1),
    budget: budget ? budgetSnapshot(budget) : null,
    github,
    availabilityIsNotExecutionProof: true
  };
}

export type CapabilitySnapshot = ReturnType<typeof capabilitySnapshot>;

/** Known owner project locations are navigation hints, not authorization or live evidence. */
export function projectDiscoveryInstruction(github: GitHubConnectionStatus | null, request?: unknown): string {
  if (!github) return '';
  const read = new Set(github.readRepositories.map(r=>r.toLowerCase()));
  const write = new Set(github.developmentRepositories.map(r=>r.toLowerCase()));
  const matched = matchOwnerProjects(request);
  const rows = OWNER_PROJECTS.map(p=>p.name+' | '+p.repository+' | '+p.path+' | '+(p.urls.join(', ')||'URL doğrulanmadı')+' | '+p.evidence+' | '+(read.has(p.repository.toLowerCase())?'okuma izin listesinde':'okuma izin listesinde değil')+' | '+(write.has(p.repository.toLowerCase())?'ajan geliştirme listesinde':'ajan geliştirme listesinde değil'));
  return '\nProje kataloğu (GitHub kaynakları, README, Firebase config; mevcut canlı site veya erişim kanıtı değildir):\n'+rows.join('\n')+
    '\n'+(matched.length===1?'İstek için en belirgin proje eşleşmesi: '+matched[0].name+' / '+matched[0].repository+' / '+matched[0].path:matched.length>1?'Birden fazla proje veya ortak hedef eşleşmesi: '+matched.map(p=>p.name).join(', ')+'; tüm açıkça istenen projeleri işle, aynı hedefe ait belirsiz eşleşmeleri kaynak kanıtı ile ayır.':'Kesin katalog eşleşmesi yok; izinli depoları ve alt klasörleri araştır.')+
    '\nBorsa Günlüğü: depo okuma izin listesinde değilse erişim kapsamı eksik olduğunu söyle, başka depolara bakıp proje yok deme. Depo ajan geliştirme listesinde değilse yazma yetkisi yoktur. İzinli hedefte github_inspect ile önce bu depoyu kontrol et. '+
    'Kullanıcıdan depo adı/URL istemeden önce mevcut katalog, izinli depo listesi, README, firebase.json, .firebaserc, gerçek directory, dal ve commit ile eşleştir. Yeni izinli depoları da incele; katalogda olmayan proje yok demek değildir. '+
    'İlk GitHub incelemesi için github_inspect action=project, repository ve kaynak path kullan; bu tek çağrı kök ve proje dizini, ana dal, güncel commit, açık PR sonuçlarını getirir. CI kuyruğu beklerken github_inspect wait_checks ile aynı tam SHA için sonuçları izle; sonucu tamamlanmadan merge etme. Aynı veriyi yeniden isteme; directory için kök path boş veya nokta olabilir. 404 durumunda önce dizin sonucundan gerçek yolu seç; 403 erişim veya koruma sınırını dolanma. INVALID_GITHUB_BRANCH durumunda kullanıcıya dal adı sorma: branch işlemini branch alanı olmadan çağır, sunucunun ürettiği güvenli dalı file/pull çağrılarında kullan. Borsa projesinin fiyat API kaynakları borsa-worker/, istemci borsa-gunlugu/ içindedir; worker yapılandırmasını da araştır. github_develop aktif değilse değişiklik yapamadığını somut kapsamla açıkla. Salt okunur incelemeyi hemen başlat; erişilemedi ile bulunamadı ayrıdır. Birden fazla aynı isimli projede kaynak veya hedef kanıtı olmadan değişiklik/merge/deploy yapma. Ortak Firebase hedeflerinde gerçek release kaynağını doğrula. URL yapılandırması canlı sağlık kanıtı değildir; project_health aracı varsa gerçek HTTP/marker/CORS kanıtını al, oturumlu işlev ve backend sürüm kanıtını ayrı tut. Var olan güvenlik ve onay sınırları geçerlidir.';
}

export function capabilityInstruction(snapshot: CapabilitySnapshot, request?: unknown): string {
  return 'SUNUCU TARAFINDAN DOĞRULANAN BU OTURUMUN YETENEKLERİ (model tahmini değil): ' +
    JSON.stringify(snapshot) +
    '\nAraç türü, araç turu ve tekil çağrı farklıdır. Kullanıcı kapasiteyi sorarsa bu gerçek değerleri kullan; sınırsız çalışma iddia etme. ' +
    'Katalogdaki ama kullanılabilir olmayan araçları aktif diye sunma. runtime_status güncel sayaçları döndürür. ' +
    'Bir aracın kullanılabilir olması her işlemi yapabileceği, onaysız yazabileceği veya görevin tamamlandığı anlamına gelmez. ' +
    'github_release aktifse yalnız desteklenen depo/hedef için kullanıcının açık yayın talebi ve sunucu tarafından doğrulanan önceden tanımlı izin kapsamında ek onay istemeden open, merge, publish adımlarını kullan. Yayın isteğinde baştan github_release open ile hazır PR aç, gereksiz draft PR oluşturma; mevcut draft varsa ikinci PR açma. Açık geri alma talebinde rollback_pr yalnız izinli değiştirilmiş kaynak dosyalarını ayrı PR ile geri getirir. CI geçmeden merge etme. Hafize uygulamasının ana adresi https://hafize-free.onrender.com; yayın hedefi render. Firebase yalnız eski giriş yönlendirmesi, ana uygulama yayını değildir. Render hook yapılandırılmamışsa açıkça bildir, başka hedefe geçme. Exact SHA, CI ve canlı kanıtı ayır. github_inspect jobs ile başarısız test adımını bul; web_page_render varsa açık siteyi tarayıcıda kontrol et. GitHub geliştirme talebinde github_inspect ile güncel main SHA, mevcut PR durumu ve ilgili test kanıtlarını doğrula. Eski sohbet veya uyarı mesajından kesin hata teşhisi üretme. ' +
    'Araç yoksa yetkiyi dolanmak için shell_run, git_run, web, kod çalıştırma veya başka ajan kullanma; eksik bağlantıyı belirt ve izinli salt-okunur analiz yap. ' +
    'nvidia_workspace varsa katalog, gerçek test sonuçları, NIM servis durumu ve Blueprint gereksinimlerini ayır. İzinli sentetik testleri veya açıkça sağlanan metin işlemlerini kullan. orchestrator_list varsa devam talebinde kayıtlı görevi bul; tamamlanmış adımları tekrarlama. Orchestrator bağımsız salt-okunur adımları birlikte yürütür, belirsiz yazmaları seri ve kontrollü tutar. Kayıtlı görev listesinde interrupted gerçek süreç kesintisini gösterir; kalıcı depolama kanıtı değildir. Kesinti, sağlayıcı kotası, bağlam ve zaman aşımı daha erken sonlandırabilir.' + projectDiscoveryInstruction(snapshot.github, request);
}

/** Only standalone capability questions take the deterministic response path.
 * Do not intercept requests that also instruct the agent to perform work. */
export function isStandaloneCapabilityQuestion(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.normalize('NFC').toLocaleLowerCase('tr-TR').trim().replace(/[?!.]+$/u, '').replace(/\s+/g, ' ').trim();
  return /^(?:şu anda? |şu an |şuanda |şuan )?(?:kaç (?:tane )?araç(?: çağrısı| turu)? (?:yapabiliyorsun|yapabilirsin|kullanabiliyorsun|kullanabilirsin|var)|(?:aktif )?araçların neler|(?:aktif )?araç listesini göster|(?:araç çağrısı|araç turu) sınırın (?:ne|kaç)|kaç (?:tane )?aracın var)$/u.test(text);
}

export function formatCapabilityAnswer(snapshot: CapabilitySnapshot): string {
  const b = snapshot.budget;
  const lines = [
    `Bu oturumda **${snapshot.availableToolCount} aktif araç türü** var; sunucu kataloğunda toplam ${snapshot.catalogSize} araç tanımlı.`,
    b ? `- **Araç turu bütçesi:** ${b.maxToolRounds}; kalan: ${b.roundsRemaining}.` : '- Araç turu bütçesi bu çalışma bağlamında bildirilmemiş.',
    ...(b ? [
      `- **Tur başına en fazla:** ${b.maxCallsPerRound} çağrı; bu ana döngü için teorik üst sınır ${b.totalCallCeiling} (uzman alt çağrıları hariç).`,
      `- **Tamamlanan çağrı:** ${b.toolCallsCompleted}.`,
      ...(b.timeoutMs === null ? [] : [`- **Sunucu görev zaman aşımı:** ${Math.round(b.timeoutMs / 60000)} dakika.`]),
      ...(b.expertMaxRounds === null ? [] : [`- **Uzman ajan başına tur bütçesi:** ${b.expertMaxRounds}.`])
    ] : []),
    `- **Uzman ajan:** ${snapshot.specialistCount} (ana asistan dahil toplam ${snapshot.agentCount}).`,
    '',
    '**Aktif araçlar:** ' + (snapshot.availableTools.join(', ') || 'yok'),
    '',
    ...(snapshot.github ? [
      '**GitHub bağlantısı:** ' + ({ app: 'GitHub App yapılandırılmış (canlı erişim ayrıca doğrulanmalı)', configured_credential: 'okuma kimliği yapılandırılmış', public_read_only: 'izinli açık depoları salt-okunur okuyabilir', not_configured: 'okuma bağlantısı yapılandırılmamış' }[snapshot.github.readMode]),
      'GitHub yazma: ' + (!snapshot.github.appConfigured ? 'GitHub App sunucu kurulumu eksik' : !snapshot.github.developmentConfigured ? 'geliştirme depo izin listesi/servisi hazır değil' : !snapshot.availableTools.includes('github_develop') ? 'bu oturumun ajan yetkisi veya onay kanalı uygun değil' : 'ayrı dal ve taslak PR hazırlama aracı sunuluyor; gerçek erişim ayrıca doğrulanmalı'),
      'Okuma depoları: ' + (snapshot.github.readRepositories.join(', ') || 'yok'),
      'Ajan geliştirme kapsamı: ' + (snapshot.github.developmentRepositories.join(', ') || 'yok'), ''
    ] : []),
    '**Bu oturumda aktif olmayan araçlar:** ' + (snapshot.unavailableTools.map(item => item.name + ' (' + ({ unavailable: 'bağlantı/servis hazır değil', not_authorized: 'bu ajan için yetkili değil', approval_required: 'izin gerekli', available: 'aktif' }[item.state]) + ')').join(', ') || 'yok'),
    '',
    'Bunlar sunucu tarafından doğrulanan oturum bilgileridir. Araç çağrıları sınırsız değildir; görev daha erken bitebilir veya bağlantı, kota ve zaman aşımı nedeniyle kesilebilir. Aktif araçların her işlemi için gerekli izinler geçerlidir.'
  ];
  return lines.join('\n');
}
