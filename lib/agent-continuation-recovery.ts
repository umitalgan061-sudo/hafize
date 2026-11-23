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
  outcomes: readonly AgentToolOutcome[], reason: 'tool_budget' | 'empty_response'
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
    : 'Modelden tamamlanmış bir yanıt alınamadı.';
  const parts = [
    'İstediğin görevi tamamladığımı doğrulayamıyorum.',
    status,
    cause
  ];
  if (names.length) parts.push(`Çalıştırılan araçlar: ${names.join(', ')}.`);
  if (failedNames.length) parts.push(`Başarısız olanlar: ${failedNames.join(', ')}.`);
  parts.push(
    'Araçların çalışmış olması, kod değişikliğinin kaydedildiği, testin geçtiği veya GitHub PR açıldığı anlamına gelmiyor.',
    'İşin kalan kısmı için çalışma adımları ve varsa commit/PR kanıtı ayrıca kontrol edilmeli.'
  );
  return parts.join(' ');
}
