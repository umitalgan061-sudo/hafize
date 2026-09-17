// Hafize'nin alan modeli — tarayıcı ve sunucu tarafının paylaştığı sözleşmeler.
//
// Bu dosya çalışma zamanına hiçbir şey eklemez. Amacı, HTTP sınırının iki
// yakasında aynı şeklin iki farklı biçimde varsayılmasını engellemektir:
// `/api/agents` yanıtındaki bir alanın adı değişirse, hem `public/app.js`
// hem `server.mjs` tarafında tip denetimi durdurur.
//
// Buradaki tipler kaynaklarından türetilmiştir:
//   - ajan kaydı        → `agents/registry.json`
//   - zamanlanmış görev → `lib/task-schedule-store.mjs`
//   - araç çağrısı      → `lib/tool-call-boundary.mjs`
//   - model yanıtı      → `lib/model-response-contract.mjs`

export {};

declare global {
  /* ---------------------------------------------------------------- *
   * Sohbet
   * ---------------------------------------------------------------- */

  /** Bir sohbet turundaki konuşmacı. */
  type HafizeMessageRole = 'system' | 'user' | 'assistant' | 'tool';

  /** Modele gönderilen en sade mesaj biçimi. */
  interface HafizeWireMessage {
    role: HafizeMessageRole;
    content: string;
  }

  /** Araç çağrısı sırasında kullanıcıya gösterilen rozet. */
  interface HafizeToolActivity {
    label: string;
    state: 'running' | 'success' | 'failure';
  }

  /** Tarayıcıda saklanan mesaj; `HafizeWireMessage`'ın yerel üst kümesi. */
  interface HafizeStoredMessage extends HafizeWireMessage {
    id: string;
    at: string;
    toolActivities?: HafizeToolActivity[];
  }

  /** `hafize.conversations.v1` altında saklanan tek sohbet. */
  interface HafizeConversation {
    id: string;
    title: string;
    agentId: string;
    toolsEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    messages: HafizeStoredMessage[];
  }

  /* ---------------------------------------------------------------- *
   * Ajanlar
   * ---------------------------------------------------------------- */

  /** Ajanın yetki sınıfı; kayıt dosyasındaki `kind` alanı. */
  type HafizeAgentKind = 'primary' | 'specialist';

  /** `/api/agents` yanıtındaki ajan özeti. */
  interface HafizeAgentSummary {
    id: string;
    name: string;
    kind?: HafizeAgentKind;
    description?: string;
  }

  /** `/api/agents` yanıt gövdesi. */
  interface HafizeAgentListResponse {
    agents: HafizeAgentSummary[];
    defaultAgent: string;
  }

  /** `/api/models` yanıt gövdesi. */
  interface HafizeModelListResponse {
    models: string[];
  }

  /* ---------------------------------------------------------------- *
   * Araç çağrısı
   * ---------------------------------------------------------------- */

  /** Model tarafından istenen tek araç çağrısı. */
  interface HafizeToolCall {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }

  /** Araç çalıştırıldıktan sonra modele dönen sonuç. */
  interface HafizeToolResult {
    toolCallId: string;
    name: string;
    ok: boolean;
    content: string;
  }

  /* ---------------------------------------------------------------- *
   * Zamanlanmış görevler
   * ---------------------------------------------------------------- */

  /** Görev yaşam döngüsündeki durumlar. */
  type HafizeScheduleStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';

  /** `lib/task-schedule-store.mjs` tarafından üretilen görev kaydı. */
  interface HafizeScheduleEntry {
    scheduleId: string;
    traceId: string;
    ownerId: string | null;
    agentId: string;
    task: string;
    runAt: string;
    status: HafizeScheduleStatus;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    createdAt: string;
    /** Kayıt hiç güncellenmediyse `null`. */
    updatedAt: string | null;
  }

  /** `POST /api/schedules` istek gövdesi. */
  interface HafizeScheduleRequest {
    agentId: string;
    task: string;
    runAt: string;
    maxAttempts?: number;
  }

  /* ---------------------------------------------------------------- *
   * Hata sözleşmesi
   * ---------------------------------------------------------------- */

  /**
   * API hataları makine tarafından okunabilir bir kod taşır; gövdede asla
   * yığın izi, dosya yolu veya secret bulunmaz.
   */
  interface HafizeApiError {
    error: string;
    detail?: string;
  }

  /**
   * Kod taşıyan çalışma zamanı hatası.
   *
   * `lib/` boyunca hatalar `new Error('INVALID_X')` biçiminde kod taşır;
   * bazıları ayrıca sayısal bir HTTP durumu ekler.
   */
  interface HafizeCodedError extends Error {
    code?: string;
    status?: number;
    /** Yukarı akış gövdesinden kırpılmış, secret içermeyen ayrıntı. */
    detail?: string;
  }
}
