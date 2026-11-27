/**
 * Truthful completion recovery for agent runs that end with empty model text.
 *
 * Tool activity badges indicate that a tool returned, NOT that the user's
 * requested deliverable was produced. A model silence must never be turned
 * into "ask the question differently" or "the work is done".
 */
export interface AgentToolOutcome {
  readonly name: string;
  readonly ok: boolean;
  readonly error?: string | null;
  readonly status?: number | null;
}

const MAX_SHOWN_TOOLS = 5;

function safeToolName(value: string): string {
  // Take a safe first token; never concatenate untrusted prose after it.
  return String(value || '').match(/^[a-zA-Z][a-zA-Z0-9_.-]{0,47}/)?.[0] || '';
}

export function buildFinalToolInstruction(outcomes: readonly AgentToolOutcome[]): string {
  const successes = outcomes.filter((item) => item.ok).length;
  const failures = outcomes.length - successes;
  return [
    'Bu çalışma turunda araç kullanımının sonuna gelindi. Yeni araç çağırma.',
    'Kullanıcının asıl talebini karşılayan SOMUT sonuçları özetle.',
    'Yalnızca gerçek araç sonuçlarıyla doğrulanan işlemleri tamamlandı diye anlat.',
    'Git komutunun, bir çalışma klasörü işleminin veya web sayfası okumanın başarılı olması; kodun değiştirildiğini, testlerin geçtiğini veya PR açıldığını tek başına kanıtlamaz.',
    'İstenen değişiklik yapılmadıysa veya doğrulanmadıysa bunu açıkça söyle; kalan adımları belirt.',
    'Yeni bir işe başlıyorum / şimdi inceleyeceğim diyerek yanıtı bitirme.',
    `Bu turdaki araç sayısı: ${outcomes.length}, başarılı: ${successes}, başarısız: ${failures}.`
  ].join(' ');
}

export function isEmptyOrProgressOnlyAnswer(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return true;
  const text = value.replace(/\s+/g, ' ').trim();
  // A pure intention is NOT an accomplished development task; allow a
  // substantive status report even when it includes these expressions.
  return text.length <= 230 && (
    /^(?:evet[,!. ]*\s*)?(?:şimdi|önce|hemen)?\s*(?:kod değişikliklerine başlıyorum|kodları incelemeye başlıyorum|depoyu inceleyeceğim|ilgili dosyaları inceleyeyim|gerekli işlemleri yapacağım|çalışmaya başlıyorum)[.!\s]*(?:önce.*(?:inceleyeceğim|inceleyeyim)[.!\s]*)?$/iu.test(text)
    || /^(?:işlemlere başlıyorum|incelemeye başlıyorum)[.!\s]*$/iu.test(text)
  );
}

export function incompleteAgentRunAnswer(
  outcomes: readonly AgentToolOutcome[], reason: 'tool_budget' | 'no_progress' | 'empty_response' | 'interrupted'
): string {
  const successes = outcomes.filter((item) => item.ok).length;
  const failures = outcomes.length - successes;
  const names = [...new Set(outcomes.map((item) => safeToolName(item.name)).filter(Boolean))].slice(-MAX_SHOWN_TOOLS);
  const failedNames = [...new Set(outcomes.filter((item) => !item.ok).map((item) => safeToolName(item.name)).filter(Boolean))].slice(-3);
  const status = outcomes.length
    ? `Bu turda ${outcomes.length} araç çağrısından ${successes} tanesi başarılı, ${failures} tanesi başarısız oldu.`
    : 'Bu turda doğrulanmış bir araç sonucu bulunmuyor.';
  const cause = reason === 'tool_budget'
    ? 'Araç turu sınırına ulaştım.'
    : reason === 'no_progress' ? 'Ardışık araç çağrıları ilerleme sağlamadığı için döngü durduruldu; bu, araç bütçesinin tükendiği anlamına gelmez.'
    : reason === 'interrupted' ? 'Bağlantı, sağlayıcı veya çalışma süresi nedeniyle görev kesildi.' : 'Modelden tamamlanmış bir yanıt alınamadı.';
  const parts = [
    'İstediğin görevi tamamladığımı doğrulayamıyorum.',
    status,
    cause
  ];
  if (names.length) parts.push(`Çalıştırılan araçlar: ${names.join(', ')}.`);
  if (failedNames.length) parts.push(`Başarısız olanlar: ${failedNames.join(', ')}.`);
  const codes = [...new Set(outcomes.filter(item=>!item.ok).map(item=>{
    const code = typeof item.error === 'string' && /^(?:[A-Z][A-Z0-9_]{1,79}|[45][0-9]{2})$/.test(item.error) ? item.error : '';
    const status = typeof item.status==='number' && Number.isInteger(item.status) && item.status>=400 && item.status<600 ? ' HTTP '+item.status : '';
    return code ? safeToolName(item.name)+': '+code+status : '';
  }).filter(Boolean))].slice(-8);
  if(codes.length) parts.push('Somut hata kodları: '+codes.join('; ')+'.');
  parts.push(
    'Araçların çalışmış olması, kod değişikliğinin kaydedildiği, testin geçtiği veya GitHub PR açıldığı anlamına gelmiyor.',
    'İşin kalan kısmı için çalışma adımları ve varsa commit/PR kanıtı ayrıca kontrol edilmeli.'
  );
  return parts.join(' ');
}

/** Give a stalled model a bounded, evidence-based repair opportunity. */
export function buildProgressRepairInstruction(outcomes: readonly AgentToolOutcome[], rounds: number): string {
 const failures=outcomes.filter(o=>!o.ok).map(o=>{
  const code=typeof o.error==='string'&&/^[A-Z0-9_]{1,80}$/.test(o.error)?o.error:'UNKNOWN';
  const status=typeof o.status==='number'&&Number.isInteger(o.status)&&o.status>=400&&o.status<600?' HTTP '+o.status:'';
  return safeToolName(o.name)+': '+code+status;
 });
 return 'İlerleme kurtarma: '+rounds+' ardışık tur başarısız oldu. Son hata kanıtı: '+[...new Set(failures)].join('; ')+
 '. Aynı çağrıyı tekrar gönderme. 404 veya geçersiz yol için proje/dizin sonucundaki gerçek yolu kullan; 403 için izin kapsamını kontrol et ve güvenlik engelini dolanma. '+
 'INVALID_GITHUB_BRANCH ise hafize/auto-borsa-market-fix gibi geçerli küçük ASCII dalı seç; kullanıcıya dal adı sorma. REPEATED_TOOL_CALL ise önceki başarılı sonucu kullan. Kod değişikliği istendiyse yeterli kanıt varsa izinli github_develop ile ayrı dal, dosya değişikliği ve taslak PR adımına geç. '+
 'Yeni ve anlamlı bir adım yoksa gerçek engeli ve doğrulanmış bulguları açıkça bildir. Başarı uydurma.';
}

/** Fixed diagnostic vocabulary: do not echo raw upstream bodies, credentials,
 * arbitrary exception messages or user content into logs or checkpoints. */
export function agentInterruptionDiagnostic(error:unknown,signal?:AbortSignal,stage:'setup'|'model_round'|'execution'='execution'):string{
 const value=signal?.aborted?signal.reason:error;
 const e=value&&typeof value==='object'?value as {code?:unknown;message?:unknown;name?:unknown;status?:unknown}:{};
 const allowed=new Set(['REQUEST_TIMEOUT','CLIENT_DISCONNECTED','AGENT_TURN_CANCELLED','AGENT_TURN_SERVER_SHUTDOWN','NVIDIA_CHAT_ERROR','INVALID_NVIDIA_RESPONSE','TOOL_ABORTED','MODEL_LAB_BUDGET','MODEL_LAB_PROVIDER_PAUSED']);
 const known=[e.code,e.message].find(v=>typeof v==='string'&&allowed.has(v));
 const status=typeof e.status==='number'&&Number.isInteger(e.status)&&e.status>=400&&e.status<=599?e.status:null;
 const code=known??(signal?.aborted?'AGENT_ABORTED':e.name==='TimeoutError'?'REQUEST_TIMEOUT':stage==='model_round'?'MODEL_ROUND_FAILED':stage==='setup'?'AGENT_SETUP_FAILED':'AGENT_EXECUTION_FAILED');
 return stage+': '+code+(status?' (HTTP '+status+')':'');
}

/** Prefer a different configured, ready chat model only during bounded
 * delivery repair. The tried set is request-local: do not penalize a model
 * globally merely for failing to produce a write in one conversation. */
export function deliveryRepairModel(chain:readonly {model:string;ready:boolean}[],tried:ReadonlySet<string>):string|null{
 return chain.find(row=>row.ready===true&&typeof row.model==='string'&&row.model.length<=260&&row.model.trim()===row.model&&row.model.length>0&&!tried.has(row.model)&&!/safety|guard|(?:^|[-/])vl(?:[-/]|$)|vision|embed|rerank|transcrib|parakeet|whisper|(?:^|[-/])tts(?:[-/]|$)|(?:^|[-/])ocr(?:[-/]|$)/i.test(row.model))?.model??null;
}
export function deliveryRepairTokenBudget(requested:number):number{
 return Math.min(8192,Math.max(6144,Number.isFinite(requested)?Math.floor(requested):6144));
}
