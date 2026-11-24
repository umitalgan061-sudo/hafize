/** Server-owned execution facts. Never accept limits or permissions from a model/client. */
export const MAX_ROOT_CALLS_PER_ROUND = 8;
export const MAX_EXPERT_CALLS_PER_ROUND = 4;
export const LONG_RUN_LEDGER_ENTRIES = 2048;
export const MAX_EXPERT_ROUNDS = 12;

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

export function capabilitySnapshot(inventory: readonly ToolInventoryEntry[], budget: RuntimeBudget | null, agentCount: number) {
  const availableTools = inventory.filter(item => item.state === 'available').map(item => item.name);
  return {
    catalogSize: inventory.length,
    availableToolCount: availableTools.length,
    availableTools,
    unavailableTools: inventory.filter(item => item.state !== 'available'),
    agentCount,
    specialistCount: Math.max(0, agentCount - 1),
    budget: budget ? budgetSnapshot(budget) : null,
    availabilityIsNotExecutionProof: true
  };
}

export type CapabilitySnapshot = ReturnType<typeof capabilitySnapshot>;

export function capabilityInstruction(snapshot: CapabilitySnapshot): string {
  return 'SUNUCU TARAFINDAN DOĞRULANAN BU OTURUMUN YETENEKLERİ (model tahmini değil): ' +
    JSON.stringify(snapshot) +
    '\nAraç türü, araç turu ve tekil çağrı farklıdır. Kullanıcı kapasiteyi sorarsa bu gerçek değerleri kullan; sınırsız çalışma iddia etme. ' +
    'Katalogdaki ama kullanılabilir olmayan araçları aktif diye sunma. runtime_status güncel sayaçları döndürür. ' +
    'Bir aracın kullanılabilir olması her işlemi yapabileceği, onaysız yazabileceği veya görevin tamamlandığı anlamına gelmez. ' +
    'Kesinti, sağlayıcı kotası, bağlam ve zaman aşımı daha erken sonlandırabilir.';
}

/** Only standalone capability questions take the deterministic response path.
 * Do not intercept requests that also instruct the agent to perform work. */
export function isStandaloneCapabilityQuestion(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.normalize('NFC').toLocaleLowerCase('tr-TR').replace(/[?!.]+$/u, '').replace(/\s+/g, ' ').trim();
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
    '**Bu oturumda aktif olmayan araçlar:** ' + (snapshot.unavailableTools.map(item => item.name + ' (' + ({ unavailable: 'bağlantı/servis hazır değil', not_authorized: 'bu ajan için yetkili değil', approval_required: 'izin gerekli', available: 'aktif' }[item.state]) + ')').join(', ') || 'yok'),
    '',
    'Bunlar sunucu tarafından doğrulanan oturum bilgileridir. Araç çağrıları sınırsız değildir; görev daha erken bitebilir veya bağlantı, kota ve zaman aşımı nedeniyle kesilebilir. Aktif araçların her işlemi için gerekli izinler geçerlidir.'
  ];
  return lines.join('\n');
}
