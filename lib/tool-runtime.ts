import { authorizeAgentTool, type AgentDefinition } from './agent-runtime.ts';
import { realpath, stat, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANVA_READ_TOOL_DEFINITION } from './canva-read-tool-boundary.ts';
import { GMAIL_READ_TOOL_DEFINITION } from './gmail-read-tool-boundary.ts';
import { normalizeToolCall, parseToolArguments, sanitizeToolError } from './tool-call-boundary.ts';
import { projectSafeToolExecutionResult } from './tool-execution-result-policy.ts';
import { WEATHER_TOOL_DEFINITION } from './weather-tool.ts';
import { WEB_TOOL_DEFINITIONS } from './web-tools.ts';
import { MEMORY_TOOL_DEFINITIONS } from './memory-tools.ts';
import type { Telemetry } from './telemetry.ts';

/** Runtime services behind the extended tools; each tool is offered only when its service is wired. */
export type ToolService = (args: Record<string, unknown>, context: ToolRuntimeContext) => Promise<unknown>;
export interface ToolServices {
  readonly research?: ToolService;
  readonly codeRun?: ToolService;
  readonly orchestrate?: ToolService;
  readonly orchestrateResume?: ToolService;
  readonly memorySearch?: ToolService;
  readonly memoryConsolidate?: ToolService;
  readonly expertFind?: ToolService;
  readonly visionAnalyze?: ToolService;
  readonly imageGenerate?: ToolService;
  readonly diagramRender?: ToolService;
  readonly webRender?: ToolService;
  readonly actionUndo?: ToolService;
  readonly workspaceFiles?: ToolService;
  readonly workspaceSqlite?: ToolService;
  readonly shellRun?: ToolService;
  readonly skillExecute?: ToolService;
  readonly skillCreate?: ToolService;
  readonly testRun?: ToolService;
  readonly testReadResult?: ToolService;
  readonly gitRun?: ToolService;
  readonly ruleCreate?: ToolService;
  readonly ruleList?: ToolService;
  readonly ruleRemove?: ToolService;
  readonly ruleSetEnabled?: ToolService;
}

export interface ToolAgent {
  readonly id: string;
  readonly name: string;
}
export interface ToolRuntimeContext {
  readonly traceId: string;
  readonly agent: ToolAgent;
  readonly registry?: { readonly agents?: readonly ToolAgent[] };
  readonly nvidiaConfigured?: boolean;
  readonly githubReadConfigured?: boolean;
  readonly githubReadFile?: (args: unknown) => Promise<unknown>;
  readonly delegateAgent?: (args: unknown) => Promise<unknown>;
  readonly approvalGranted?: boolean;
  readonly canvaReadAuthenticated?: boolean;
  readonly canvaReadTool?: { readonly execute: (args: unknown) => Promise<unknown> };
  readonly gmailReadAuthenticated?: boolean;
  readonly gmailReadTool?: { readonly execute: (args: unknown) => Promise<unknown> };
  readonly skillsRuntime?: { readonly resolveForAgent: (args: unknown) => unknown };
  readonly weatherLookup?: (args: unknown, signal?: AbortSignal) => Promise<unknown>;
  readonly webTools?: Readonly<Partial<Record<'search' | 'readPage' | 'wikipedia' | 'news' | 'rates', (args: unknown, signal?: AbortSignal) => Promise<unknown>>>>;
  readonly memory?: { readonly save: (args: unknown) => Promise<unknown>; readonly forget: (args: unknown) => Promise<unknown> };
  readonly signal?: AbortSignal;
  /** Absolute workspace root used by the read-only fs.read tool. */
  readonly workspaceRoot?: string;
  readonly ownerId?: string;
  readonly sessionId?: string;
  readonly services?: ToolServices;
  readonly telemetry?: Telemetry | null;
  /** Asks the user (inline, on the open stream) to approve a risky action. */
  readonly requestApproval?: (request: { readonly kind: string; readonly title: string; readonly detail: string; readonly risk: 'low' | 'medium' | 'high' }) => Promise<boolean>;
  /** Progress messages from long-running tools (research, orchestration). */
  readonly onProgress?: (tool: string, label: string) => void;
}

export type ToolDefinition = Readonly<{
  type: 'function';
  function: Readonly<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}>;

type ToolKind = 'diagnostic' | 'delegation' | 'connector' | 'repository' | 'skill' | 'web' | 'memory' | 'research' | 'sandbox' | 'orchestrator' | 'media' | 'local' | 'action';
type ToolActivity = Readonly<{ running: string; success: string; failure: string }>;

export interface ToolEntry {
  readonly permission: string;
  readonly kind: ToolKind;
  readonly timeoutMs: number;
  readonly definition: ToolDefinition;
  readonly available?: (context: ToolRuntimeContext) => boolean;
  readonly execute: (args: Record<string, unknown>, context: ToolRuntimeContext) => Promise<unknown>;
  readonly activity: ToolActivity;
}

export interface ToolExecutionSuccess<T = unknown> {
  readonly ok: true;
  readonly tool: string;
  readonly value: T;
  readonly durationMs: number;
}
export interface ToolExecutionFailure {
  readonly ok: false;
  readonly tool: string;
  readonly error: string;
  readonly reason?: string;
  readonly status?: number;
  readonly durationMs: number;
  readonly consentRequest?: Readonly<Record<string, unknown>>;
}
export type ToolExecutionResult<T = unknown> = ToolExecutionSuccess<T> | ToolExecutionFailure;

const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_MS = 2_000;
const MAX_TIMEOUT_MS = 120_000;
const FS_READ_ENCODINGS = new Set<BufferEncoding>(['utf-8', 'utf8', 'ascii', 'latin1', 'base64', 'hex']);

const HANDOFF_LIST = Object.freeze({ type: 'array', maxItems: 8, items: Object.freeze({ type: 'string', maxLength: 500 }) });

const definition = (name: string, description: string, properties: Record<string, unknown>): ToolDefinition =>
  Object.freeze({
    type: 'function',
    function: Object.freeze({
      name,
      description,
      parameters: Object.freeze({ type: 'object', properties: Object.freeze(properties), additionalProperties: false })
    })
  });

const strictDefinition = (name: string, description: string, properties: Record<string, unknown>, required: readonly string[]): ToolDefinition =>
  Object.freeze({
    type: 'function',
    function: Object.freeze({
      name,
      description,
      parameters: Object.freeze({ type: 'object', properties: Object.freeze(properties), required: Object.freeze([...required]), additionalProperties: false })
    })
  });

function timeout(value: unknown, fallback = DEFAULT_TIMEOUT_MS): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(Number(value), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}
function isAgentDefinition(agent: ToolAgent | AgentDefinition): agent is AgentDefinition {
  return typeof agent === 'object' && agent !== null && 'toolPolicy' in agent;
}
function authorize(agent: ToolAgent | AgentDefinition, permission: string, approvalGranted: boolean) {
  return authorizeAgentTool(agent as AgentDefinition, permission, { approvalGranted });
}
function timeoutSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timerSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timerSignal]) : timerSignal;
}
function abortedReason(signal: AbortSignal | undefined): 'TOOL_ABORTED' | 'TOOL_TIMEOUT' | null {
  if (!signal?.aborted) return null;
  const reason = signal.reason;
  if (reason && typeof reason === 'object' && 'name' in reason && reason.name === 'TimeoutError') return 'TOOL_TIMEOUT';
  if (reason === 'TOOL_TIMEOUT') return 'TOOL_TIMEOUT';
  return 'TOOL_ABORTED';
}

// Secrets never enter the agent context (registry policy secretsNeverEnterAgentContext): .env and
// other dotfiles, key/credential-named files, runtime data (audit log, OAuth stores) and logs.
const SENSITIVE_SEGMENT = /^(?:\.|node_modules$|data$)/i;
const SENSITIVE_NAME = /(?:secret|token|credential|password|passwd|private|id_rsa|\.pem$|\.key$|\.p12$|\.pfx$|\.crt$|\.log$|\.jsonl$)/i;
export function isSensitiveWorkspacePath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]+/).filter(Boolean);
  if (!segments.length) return true;
  return segments.some((segment) => SENSITIVE_SEGMENT.test(segment)) || SENSITIVE_NAME.test(segments[segments.length - 1]);
}

const CATALOG = new Map<string, ToolEntry>([
  ['fs_read', {
    permission: 'fs.read',
    kind: 'repository',
    timeoutMs: timeout(10_000, 10_000),
    activity: { running: 'Workspace dosyası okunuyor', success: 'Workspace dosyası okundu', failure: 'Workspace dosyası okunamadı' },
    definition: definition('fs_read', 'Workspace içindeki bir metin dosyasını güvenli ve salt-okunur okur.', {
      path: { type: 'string' },
      encoding: { type: 'string' },
      maxBytes: { type: 'integer', minimum: 1, maximum: 1048576 }
    }),
    execute: async (args, context) => {
      const path = args.path;
      const encoding = args.encoding === undefined ? 'utf-8' : args.encoding;
      const maxBytes = args.maxBytes === undefined ? 1_048_576 : args.maxBytes;
      if (typeof path !== 'string' || !path.trim()) return { error: 'FS_READ_ERROR', code: 'INVALID_PATH', message: 'path argümanı zorunlu string olmalı' };
      if (typeof maxBytes !== 'number' || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576) return { error: 'FS_READ_ERROR', code: 'INVALID_LIMIT', message: 'maxBytes 1 ile 1048576 arasında tam sayı olmalı' };
      // Text encodings only: base64/hex output would slip past the credential filter on tool results.
      if (typeof encoding !== 'string' || (encoding !== 'utf-8' && encoding !== 'utf8')) return { error: 'FS_READ_ERROR', code: 'INVALID_ENCODING', message: 'Yalnızca utf-8 desteklenir' };
      const workspaceRoot = context.workspaceRoot || fileURLToPath(new URL('../', import.meta.url));
      const root = await realpath(resolve(workspaceRoot));
      const requested = resolve(root, path.trim());
      if (!requested.startsWith(root + sep) && requested !== root) return { error: 'FS_READ_ERROR', code: 'TRAVERSAL', message: 'Workspace dışına çıkış engellendi' };
      try {
        const resolved = await realpath(requested);
        if (!resolved.startsWith(root + sep) && resolved !== root) return { error: 'FS_READ_ERROR', code: 'TRAVERSAL', message: 'Workspace dışına çıkış engellendi' };
        if (isSensitiveWorkspacePath(relative(root, resolved))) return { error: 'FS_READ_ERROR', code: 'SENSITIVE_PATH', message: 'Bu dosya gizli bilgi içerebileceği için okunamaz' };
        const stats = await stat(resolved);
        if (!stats.isFile()) return { error: 'FS_READ_ERROR', code: 'NOT_A_FILE', message: 'Belirtilen yol bir dosya değil' };
        if (stats.size > maxBytes) return { error: 'FS_READ_ERROR', code: 'TOO_LARGE', message: `Dosya ${stats.size} bayt, limit ${maxBytes} bayt` };
        const content = await readFile(resolved, encoding);
        return { content, size: stats.size, encoding, path: path.trim() };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        const code = error.code === 'ENOENT' ? 'NOT_FOUND' : error.code === 'EACCES' ? 'PERMISSION_DENIED' : 'FS_READ_ERROR';
        return { error: 'FS_READ_ERROR', code, message: error.message || 'Okuma başarısız' };
      }
    }
  }],
  ['runtime_status', {
    permission: 'runtime.status',
    kind: 'diagnostic',
    timeoutMs: timeout(10_000, 10_000),
    activity: { running: 'Runtime durumu kontrol ediliyor', success: 'Runtime durumu kontrol edildi', failure: 'Runtime durumu kontrol edilemedi' },
    definition: definition('runtime_status', 'Hafize runtime durumunu salt-okunur olarak döndürür.', {}),
    execute: async (_args, context) => ({
      status: 'ok',
      traceId: context.traceId,
      agentId: context.agent.id,
      agentName: context.agent.name,
      nvidiaConfigured: Boolean(context.nvidiaConfigured),
      githubReadConfigured: Boolean(context.githubReadConfigured),
      availableAgents: (context.registry?.agents || []).map((agent) => ({ id: agent.id, name: agent.name }))
    })
  }],
  ['agent_delegate', {
    permission: 'agent.delegate',
    kind: 'delegation',
    timeoutMs: timeout(90_000, 90_000),
    activity: { running: 'Uzman ajan çalıştırılıyor', success: 'Uzman ajan çalıştırıldı', failure: 'Uzman ajan çalıştırılamadı' },
    definition: definition('agent_delegate', 'Dar kapsamlı bir görevi uzman Hafize ajanına delege eder.', {
      agentId: { type: 'string' },
      task: { type: 'string' },
      successCriteria: HANDOFF_LIST,
      constraints: HANDOFF_LIST,
      evidenceRequired: HANDOFF_LIST
    }),
    available: (context) => typeof context.delegateAgent === 'function',
    execute: async (args, context) => {
      const result = await context.delegateAgent!(args) as { ok?: boolean; error?: unknown; value?: unknown };
      if (result?.ok !== true) {
        const code = typeof result?.error === 'string' ? result.error : 'AGENT_DELEGATION_FAILED';
        throw Object.assign(new Error(code), { code });
      }
      return result.value;
    }
  }],
  ['github_read_file', {
    permission: 'repo.read',
    kind: 'repository',
    timeoutMs: timeout(60_000),
    activity: { running: 'GitHub dosyası okunuyor', success: 'GitHub dosyası okundu', failure: 'GitHub dosyası okunamadı' },
    definition: definition('github_read_file', 'İzin verilen GitHub reposundaki bir metin dosyasını salt-okunur getirir.', {
      repository: { type: 'string' },
      path: { type: 'string' },
      ref: { type: 'string' }
    }),
    available: (context) => Boolean(context.githubReadConfigured && context.githubReadFile),
    execute: async (args, context) => context.githubReadFile!(args)
  }],
  ['canva_read', {
    permission: 'connector.canva.read',
    kind: 'connector',
    timeoutMs: timeout(60_000),
    activity: { running: 'Canva verisi okunuyor', success: 'Canva verisi okundu', failure: 'Canva verisi okunamadı' },
    definition: CANVA_READ_TOOL_DEFINITION as ToolDefinition,
    available: (context) => context.canvaReadAuthenticated === true && Boolean(context.canvaReadTool),
    execute: async (args, context) => context.canvaReadTool!.execute(args)
  }],
  ['gmail_read', {
    permission: 'connector.gmail.read',
    kind: 'connector',
    timeoutMs: timeout(60_000),
    activity: { running: 'Gmail verisi okunuyor', success: 'Gmail verisi okundu', failure: 'Gmail verisi okunamadı' },
    definition: GMAIL_READ_TOOL_DEFINITION as ToolDefinition,
    available: (context) => context.gmailReadAuthenticated === true && Boolean(context.gmailReadTool),
    execute: async (args, context) => context.gmailReadTool!.execute(args)
  }],
  ['weather_forecast', {
    permission: 'web.weather.read',
    kind: 'web',
    timeoutMs: timeout(20_000, 20_000),
    activity: { running: 'Hava durumu alınıyor', success: 'Hava durumu alındı', failure: 'Hava durumu alınamadı' },
    definition: WEATHER_TOOL_DEFINITION as ToolDefinition,
    available: (context) => typeof context.weatherLookup === 'function',
    execute: async (args, context) => context.weatherLookup!(args, context.signal)
  }],
  ...([
    ['web_search', 'search', 'web.search', 20_000, { running: 'İnternette aranıyor', success: 'İnternette arandı', failure: 'İnternet araması yapılamadı' }],
    ['web_page_read', 'readPage', 'web.read', 25_000, { running: 'Web sayfası okunuyor', success: 'Web sayfası okundu', failure: 'Web sayfası okunamadı' }],
    ['wikipedia_lookup', 'wikipedia', 'web.wikipedia.read', 15_000, { running: 'Vikipedi\'ye bakılıyor', success: 'Vikipedi\'ye bakıldı', failure: 'Vikipedi\'ye ulaşılamadı' }],
    ['news_search', 'news', 'web.news.read', 15_000, { running: 'Haberler alınıyor', success: 'Haberler alındı', failure: 'Haberler alınamadı' }],
    ['exchange_rates', 'rates', 'web.rates.read', 15_000, { running: 'Döviz kurları alınıyor', success: 'Döviz kurları alındı', failure: 'Döviz kurları alınamadı' }]
  ] as const).map(([name, method, permission, timeoutMs, activity]): [string, ToolEntry] => [name, {
    permission,
    kind: 'web',
    timeoutMs: timeout(timeoutMs, timeoutMs),
    activity,
    definition: WEB_TOOL_DEFINITIONS[name] as ToolDefinition,
    available: (context) => typeof context.webTools?.[method] === 'function',
    execute: async (args, context) => context.webTools![method]!(args, context.signal)
  }]),
  ['memory_save', {
    permission: 'memory.write',
    kind: 'memory',
    timeoutMs: timeout(5_000, 5_000),
    activity: { running: 'Hafızaya kaydediliyor', success: 'Hafızaya kaydedildi', failure: 'Hafızaya kaydedilemedi' },
    definition: MEMORY_TOOL_DEFINITIONS.memory_save as ToolDefinition,
    available: (context) => typeof context.memory?.save === 'function',
    execute: async (args, context) => context.memory!.save(args)
  }],
  ['memory_forget', {
    permission: 'memory.write',
    kind: 'memory',
    timeoutMs: timeout(5_000, 5_000),
    activity: { running: 'Hafızadan siliniyor', success: 'Hafızadan silindi', failure: 'Hafızadan silinemedi' },
    definition: MEMORY_TOOL_DEFINITIONS.memory_forget as ToolDefinition,
    available: (context) => typeof context.memory?.forget === 'function',
    execute: async (args, context) => context.memory!.forget(args)
  }],
  ['research_run', {
    permission: 'research.run',
    kind: 'research',
    timeoutMs: timeout(120000, 120000),
    activity: {"running":"Çok kaynaklı araştırma yapılıyor","success":"Araştırma tamamlandı","failure":"Araştırma tamamlanamadı"},
    definition: strictDefinition('research_run', "Bir soruyu birden çok kaynakta (web, Vikipedi, haberler, arXiv, Crossref, PubMed) araştırır; en güvenilir sayfaları okur, iddiaları kaynaklarıyla çıkarır, çelişkileri işaretler ve [n] atıflı bir rapor döndürür. Derin, tartışmalı veya kaynak gerektiren sorularda kullan.", {"question":{"type":"string","maxLength":500},"depth":{"type":"string","enum":["quick","standard","deep"],"description":"quick: hızlı (2 motor, 3 sayfa), standard (varsayılan), deep: akademik dahil 6 motor, 10 sayfa."},"domains":{"type":"array","items":{"type":"string"},"maxItems":5,"description":"Yalnızca bu alan adlarından kaynak kullan (örn. [\"tuik.gov.tr\"])."},"recencyDays":{"type":"integer","minimum":1,"maximum":3650,"description":"Yalnızca son N gün içindeki kaynaklar."}}, ["question"]),
    available: (context) => typeof context.services?.research === 'function',
    execute: async (args, context) => context.services!.research!(args, context)
  }],
  ['code_run', {
    permission: 'code.run',
    kind: 'sandbox',
    timeoutMs: timeout(35000, 35000),
    activity: {"running":"Kod güvenli ortamda çalıştırılıyor","success":"Kod çalıştırıldı","failure":"Kod çalıştırılamadı"},
    definition: strictDefinition('code_run', "JavaScript kodunu izole bir sandbox içinde çalıştırır (dosya, ağ ve sistem erişimi yok). Kod async bir fonksiyonun gövdesidir: `input` değişkenini okuyabilir, sonucu `return` ile döndürür, console.log çıktıları da gelir. Hesaplama, istatistik, tarih/birim dönüşümü, metin/JSON/CSV işleme ve kod doğrulama için kullan.", {"code":{"type":"string","maxLength":40000},"input":{"description":"Koda `input` olarak verilecek JSON veri."},"timeoutMs":{"type":"integer","minimum":100,"maximum":30000}}, ["code"]),
    available: (context) => typeof context.services?.codeRun === 'function',
    execute: async (args, context) => context.services!.codeRun!(args, context)
  }],
  ['orchestrator_run', {
    permission: 'orchestrator.run',
    kind: 'orchestrator',
    timeoutMs: timeout(600000, 600000),
    activity: {"running":"Çok adımlı görev planlanıp yürütülüyor","success":"Çok adımlı görev tamamlandı","failure":"Çok adımlı görev tamamlanamadı"},
    definition: strictDefinition('orchestrator_run', "Karmaşık bir hedefi adımlara böler (bağımlılıklı plan), araçlarla paralel yürütür, her adımdan sonra kendini denetler (tekrar dene / planı değiştir / dur), bütçe sınırlarına uyar ve sonucu birleştirir. Birden çok araç ve adım gerektiren işler için kullan.", {"goal":{"type":"string","maxLength":1000},"constraints":{"type":"array","items":{"type":"string"},"maxItems":10},"maxSteps":{"type":"integer","minimum":1,"maximum":20}}, ["goal"]),
    available: (context) => typeof context.services?.orchestrate === 'function',
    execute: async (args, context) => context.services!.orchestrate!(args, context)
  }],
  ['orchestrator_resume', {
    permission: 'orchestrator.run',
    kind: 'orchestrator',
    timeoutMs: timeout(600000, 600000),
    activity: {"running":"Görev kaldığı yerden sürdürülüyor","success":"Görev sürdürüldü","failure":"Görev sürdürülemedi"},
    definition: strictDefinition('orchestrator_resume', "Kesilen, onay bekleyen veya bütçesi biten bir çok adımlı görevi kayıt noktasından sürdürür.", {"runId":{"type":"string"},"approveSteps":{"type":"array","items":{"type":"string"}},"extraSteps":{"type":"integer","minimum":1,"maximum":20}}, ["runId"]),
    available: (context) => typeof context.services?.orchestrateResume === 'function',
    execute: async (args, context) => context.services!.orchestrateResume!(args, context)
  }],
  ['memory_search', {
    permission: 'memory.read',
    kind: 'memory',
    timeoutMs: timeout(20_000, 20_000),
    activity: { running: 'Hafızada aranıyor', success: 'Hafızada arandı', failure: 'Hafızada aranamadı' },
    definition: MEMORY_TOOL_DEFINITIONS.memory_search as ToolDefinition,
    available: (context) => typeof context.services?.memorySearch === 'function',
    execute: async (args, context) => context.services!.memorySearch!(args, context)
  }],
  ['memory_consolidate', {
    permission: 'memory.consolidate',
    kind: 'memory',
    timeoutMs: timeout(60_000, 60_000),
    activity: { running: 'Sohbet hafızaya özetleniyor', success: 'Sohbet hafızaya kaydedildi', failure: 'Sohbet hafızaya kaydedilemedi' },
    definition: MEMORY_TOOL_DEFINITIONS.memory_consolidate as ToolDefinition,
    available: (context) => typeof context.services?.memoryConsolidate === 'function',
    execute: async (args, context) => context.services!.memoryConsolidate!(args, context)
  }],
  ['expert_find', {
    permission: 'agent.discover',
    kind: 'delegation',
    timeoutMs: timeout(10000, 10000),
    activity: {"running":"Uygun uzman aranıyor","success":"Uzman bulundu","failure":"Uzman bulunamadı"},
    definition: strictDefinition('expert_find', "Bir görev için en uygun uzman ajanları yetenek kartlarına, güven düzeyine ve sağlık durumuna göre sıralar. Ardından agent_delegate ile görevi ver.", {"query":{"type":"string","maxLength":300},"limit":{"type":"integer","minimum":1,"maximum":5}}, ["query"]),
    available: (context) => typeof context.services?.expertFind === 'function',
    execute: async (args, context) => context.services!.expertFind!(args, context)
  }],
  ['vision_analyze', {
    permission: 'vision.analyze',
    kind: 'media',
    timeoutMs: timeout(60000, 60000),
    activity: {"running":"Görsel inceleniyor","success":"Görsel incelendi","failure":"Görsel incelenemedi"},
    definition: strictDefinition('vision_analyze', "Kullanıcının yüklediği veya üretilen görselleri (img_... kimlikleri) görüntü modeliyle analiz eder: açıklama, görseldeki yazılar (OCR), nesneler, tablo/grafik verisi.", {"imageIds":{"type":"array","items":{"type":"string"},"minItems":1,"maxItems":4},"prompt":{"type":"string","maxLength":2000,"description":"Görsel hakkında özel soru."}}, ["imageIds"]),
    available: (context) => typeof context.services?.visionAnalyze === 'function',
    execute: async (args, context) => context.services!.visionAnalyze!(args, context)
  }],
  ['image_generate', {
    permission: 'image.generate',
    kind: 'media',
    timeoutMs: timeout(100000, 100000),
    activity: {"running":"Görsel oluşturuluyor","success":"Görsel oluşturuldu","failure":"Görsel oluşturulamadı"},
    definition: strictDefinition('image_generate', "Metin açıklamasından görsel üretir (güvenlik denetimli). Dönen markdown satırını yanıtına ekle. Açıklamayı ayrıntılı ve İngilizce yazarsan sonuç daha iyi olur.", {"prompt":{"type":"string","maxLength":1500},"width":{"type":"integer","enum":[512,768,1024,1280]},"height":{"type":"integer","enum":[512,768,1024,1280]},"seed":{"type":"integer"}}, ["prompt"]),
    available: (context) => typeof context.services?.imageGenerate === 'function',
    execute: async (args, context) => context.services!.imageGenerate!(args, context)
  }],
  ['diagram_render', {
    permission: 'diagram.render',
    kind: 'media',
    timeoutMs: timeout(60000, 60000),
    activity: {"running":"Diyagram çiziliyor","success":"Diyagram çizildi","failure":"Diyagram çizilemedi"},
    definition: strictDefinition('diagram_render', "Mermaid, Vega-Lite (JSON) veya Graphviz (DOT) kaynağından SVG ve PNG dosyası üretir; indirilebilir dosya gerektiğinde kullan.", {"kind":{"type":"string","enum":["mermaid","vega-lite","graphviz"]},"source":{"type":"string","maxLength":20000}}, ["kind","source"]),
    available: (context) => typeof context.services?.diagramRender === 'function',
    execute: async (args, context) => context.services!.diagramRender!(args, context)
  }],
  ['web_page_render', {
    permission: 'web.render',
    kind: 'web',
    timeoutMs: timeout(45000, 45000),
    activity: {"running":"Sayfa tarayıcıda açılıyor","success":"Sayfa tarayıcıda açıldı","failure":"Sayfa açılamadı"},
    definition: strictDefinition('web_page_render', "JavaScript ile yüklenen bir web sayfasını gerçek tarayıcıda açar ve görünen metnini (isteğe bağlı ekran görüntüsüyle) getirir. web_page_read boş/eksik içerik döndürürse kullan.", {"url":{"type":"string","maxLength":2048},"screenshot":{"type":"boolean"}}, ["url"]),
    available: (context) => typeof context.services?.webRender === 'function',
    execute: async (args, context) => context.services!.webRender!(args, context)
  }],
  ['action_undo', {
    permission: 'action.undo',
    kind: 'action',
    timeoutMs: timeout(30000, 30000),
    activity: {"running":"İşlem geri alınıyor","success":"İşlem geri alındı","failure":"İşlem geri alınamadı"},
    definition: strictDefinition('action_undo', "Daha önce yapılan bir değişikliği (hafıza kaydı, dosya yazma, skill işlemi) geri alır. actionId verilmezse son geri alınabilir işlemleri listeler.", {"actionId":{"type":"string"}}, []),
    available: (context) => typeof context.services?.actionUndo === 'function',
    execute: async (args, context) => context.services!.actionUndo!(args, context)
  }],
  ['workspace_files', {
    permission: 'workspace.files',
    kind: 'local',
    timeoutMs: timeout(20000, 20000),
    activity: {"running":"Çalışma klasörüne erişiliyor","success":"Çalışma klasörü işlemi tamamlandı","failure":"Çalışma klasörü işlemi başarısız"},
    definition: strictDefinition('workspace_files', "Kullanıcının bilgisayarındaki Hafize çalışma klasöründe dosya listeler, okur veya yazar (yazma geri alınabilir). Klasör dışına çıkılamaz.", {"action":{"type":"string","enum":["list","read","write"]},"path":{"type":"string","maxLength":400},"content":{"type":"string"},"append":{"type":"boolean"}}, ["action"]),
    available: (context) => typeof context.services?.workspaceFiles === 'function',
    execute: async (args, context) => context.services!.workspaceFiles!(args, context)
  }],
  ['workspace_sqlite', {
    permission: 'workspace.sqlite',
    kind: 'local',
    timeoutMs: timeout(30000, 30000),
    activity: {"running":"Veritabanı sorgulanıyor","success":"Veritabanı sorgulandı","failure":"Veritabanı sorgulanamadı"},
    definition: strictDefinition('workspace_sqlite', "Çalışma klasöründeki bir SQLite veritabanında SQL çalıştırır. SELECT doğrudan çalışır; değişiklik yapan sorgular kullanıcı onayı ister.", {"path":{"type":"string","maxLength":400},"sql":{"type":"string","maxLength":10000},"params":{"type":"array"}}, ["path","sql"]),
    available: (context) => typeof context.services?.workspaceSqlite === 'function',
    execute: async (args, context) => context.services!.workspaceSqlite!(args, context)
  }],
  ['shell_run', {
    permission: 'shell.run',
    kind: 'local',
    timeoutMs: timeout(75000, 75000),
    activity: {"running":"Komut onayı bekleniyor / çalıştırılıyor","success":"Komut çalıştırıldı","failure":"Komut çalıştırılamadı"},
    definition: strictDefinition('shell_run', "Kullanıcının bilgisayarında (çalışma klasöründe) bir kabuk komutu çalıştırır (Windows: PowerShell). Her komut çalıştırılmadan önce kullanıcıya gösterilip onayı alınır. Yalnızca kullanıcı açıkça istediğinde kullan.", {"command":{"type":"string","maxLength":4000},"timeoutMs":{"type":"integer","minimum":1000,"maximum":60000}}, ["command"]),
    available: (context) => typeof context.services?.shellRun === 'function',
    execute: async (args, context) => context.services!.shellRun!(args, context)
  }],
  ['skill_invoke', {
    permission: 'skill.invoke',
    kind: 'skill',
    timeoutMs: timeout(30_000, 30_000),
    activity: { running: 'Hafize skill’i hazırlanıyor', success: 'Hafize skill’i hazırlandı', failure: 'Hafize skill’i hazırlanamadı' },
    definition: definition('skill_invoke', 'Registry içindeki güvenli Hafize skill yapısını çözümler.', {
      skillId: { type: 'string' },
      args: { type: 'object' }
    }),
    available: (context) => typeof context.skillsRuntime?.resolveForAgent === 'function',
    execute: async (args, context) => {
      if (context.services?.skillExecute) return context.services.skillExecute(args, context);
      const invocation = context.skillsRuntime!.resolveForAgent({
        agent: context.agent,
        skillId: args.skillId,
        args: args.args,
        traceId: context.traceId,
        ownerId: context.ownerId,
        sessionId: context.sessionId,
        approvalGranted: context.approvalGranted === true
      }) as Record<string, unknown> | null;
      if (!invocation) throw new Error('UNKNOWN_SKILL');
      return {
        skill: invocation.name,
        execution: invocation.execution,
        model: invocation.model,
        tools: invocation.tools,
        arguments: invocation.arguments,
        parameters: invocation.parameters,
        returns: invocation.returns,
        requiredScopes: invocation.requiredScopes,
        sideEffects: invocation.sideEffects,
        riskLevel: invocation.riskLevel,
        rollbackHint: invocation.rollbackHint,
        consentId: invocation.consentId,
        prompt: invocation.prompt
      };
    }
  }],
  ['test_run', {
    permission: 'test.run',
    kind: 'sandbox',
    timeoutMs: timeout(300_000, 300_000),
    activity: { running: 'Testler çalıştırılıyor', success: 'Testler tamamlandı', failure: 'Testler çalıştırılamadı' },
    definition: strictDefinition('test_run', "Çalışma klasöründe testleri çalıştırır ve sonucu runId ile kaydeder. Yalnızca bilinen komutlar (npm test, npx vitest run, npx jest, npx pytest, go test ./...) koşturulur; sonucu test_read_result ile geri okunabilir.", {
      "command":{"type":"string","maxLength":120},
      "scope":{"type":"string","maxLength":200},
      "timeoutMs":{"type":"integer","minimum":5000,"maximum":300000}
    }, []),
    available: (context) => typeof context.services?.testRun === 'function',
    execute: async (args, context) => context.services!.testRun!(args, context)
  }],
  ['test_read_result', {
    permission: 'test.read_result',
    kind: 'sandbox',
    timeoutMs: timeout(15_000, 15_000),
    activity: { running: 'Test sonucu okunuyor', success: 'Test sonucu okundu', failure: 'Test sonucu okunamadı' },
    definition: strictDefinition('test_read_result', "Daha önce çalıştırılmış bir test sonucunu (runId ile) okur. runId verilmezse en son çalıştırılan test döner.", {
      "runId":{"type":"string","maxLength":40}
    }, []),
    available: (context) => typeof context.services?.testReadResult === 'function',
    execute: async (args, context) => context.services!.testReadResult!(args, context)
  }],
  ['git_run', {
    permission: 'git.worktree',
    kind: 'repository',
    timeoutMs: timeout(60_000, 60_000),
    activity: { running: 'Git komutu çalıştırılıyor', success: 'Git komutu tamamlandı', failure: 'Git komutu başarısız' },
    definition: strictDefinition('git_run', "Çalışma klasöründeki git deposunda salt-okunur komut çalıştırır (status, diff, log, show, branch --list). Yazma komutları kabul edilmez; onlar için kullanıcı onayı gerekir.", {
      "args":{"type":"array","items":{"type":"string"},"maxItems":12}
    }, ["args"]),
    available: (context) => typeof context.services?.gitRun === 'function',
    execute: async (args, context) => context.services!.gitRun!(args, context)
  }],
  ['rule_create', {
    permission: 'rule.create',
    kind: 'orchestrator',
    timeoutMs: timeout(30_000, 30_000),
    activity: { running: 'Kural kaydediliyor', success: 'Kural kaydedildi', failure: 'Kural kaydedilemedi' },
    definition: strictDefinition('rule_create', "Proaktif bir kural tanımlar: zamana (cron) veya çalışma klasöründeki dosya değişikliğine (file.changed) bağlı olarak kendi başına çalışır; başka olay türü yoktur. Örnek: her sabah 09:00\'de özet çıkar, veya src altındaki bir dosya değişince testleri koş. Sonuç kullanıcıya Ayarlar > Görev sonuçları altında ve bildirimle ulaşır. Kural yalnızca ne zaman çalışacağını belirler; işlem sahibinin kendi ajan politikasıyla koşar, yetkiyi genişletmez.", {
      "name":{"type":"string","maxLength":64},
      "description":{"type":"string","maxLength":300},
      "trigger":{"type":"object","description":"{kind:'cron', expression:'0 9 * * *'} veya {kind:'event', event:'file.changed', path:'src/**/*.ts'} (path isteğe bağlıdır, çalışma klasörüne görelidir)"},
      "task":{"type":"string","maxLength":4000},
      "agentId":{"type":"string","maxLength":120},
      "cooldownMs":{"type":"integer","minimum":0,"maximum":86400000}
    }, ["name","trigger","task","agentId"]),
    available: (context) => typeof context.services?.ruleCreate === 'function',
    execute: async (args, context) => context.services!.ruleCreate!(args, context)
  }],
  ['rule_list', {
    permission: 'rule.read',
    kind: 'orchestrator',
    timeoutMs: timeout(15_000, 15_000),
    activity: { running: 'Kurallar listeleniyor', success: 'Kurallar listelendi', failure: 'Kurallar listelenemedi' },
    definition: strictDefinition('rule_list', "Kullanıcının tanımlı proaktif kurallarını listeler.", {}, []),
    available: (context) => typeof context.services?.ruleList === 'function',
    execute: async (args, context) => context.services!.ruleList!(args, context)
  }],
  ['rule_remove', {
    permission: 'rule.create',
    kind: 'orchestrator',
    timeoutMs: timeout(15_000, 15_000),
    activity: { running: 'Kural siliniyor', success: 'Kural silindi', failure: 'Kural silinemedi' },
    definition: strictDefinition('rule_remove', "Bir proaktif kuralı siler.", {"ruleId":{"type":"string","maxLength":60}}, ["ruleId"]),
    available: (context) => typeof context.services?.ruleRemove === 'function',
    execute: async (args, context) => context.services!.ruleRemove!(args, context)
  }],
  ['rule_set_enabled', {
    permission: 'rule.create',
    kind: 'orchestrator',
    timeoutMs: timeout(15_000, 15_000),
    activity: { running: 'Kural güncelleniyor', success: 'Kural güncellendi', failure: 'Kural güncellenemedi' },
    definition: strictDefinition('rule_set_enabled', "Bir kuralı duraklatır veya yeniden etkinleştirir.", {"ruleId":{"type":"string","maxLength":60},"enabled":{"type":"boolean"}}, ["ruleId","enabled"]),
    available: (context) => typeof context.services?.ruleSetEnabled === 'function',
    execute: async (args, context) => context.services!.ruleSetEnabled!(args, context)
  }],
  ['skill_create', {
    permission: 'skill.create',
    kind: 'skill',
    timeoutMs: timeout(45_000, 45_000),
    activity: { running: 'Yeni skill kaydediliyor', success: 'Skill kaydedildi', failure: 'Skill kaydedilemedi' },
    definition: strictDefinition('skill_create', "Yeni bir Hafize skill'i tanımlar ve kalıcı olarak kaydeder; sonra skill_invoke ile çağrılabilir. manifest aynı doğrulayıcıdan geçer (ad, açıklama, allowedTools, requiredScopes, parameters JSONSchema, returns, sideEffects, riskLevel, rollbackHint). Sandbox kodlu skill'ler kaydedilmeden önce sağlık kontrolünden geçirilir. Ajan kendi yetkisinden daha geniş bir skill tanımlayamaz.", {
      "manifest":{"type":"object","description":"Skill tanımı. Zorunlu alanlar: name, description, allowedTools, prompt. İsteğe bağlı: triggers, arguments/parameters, returns, requiredScopes, sideEffects, riskLevel, rollbackHint, handler, compensate, model, execution."},
      "code":{"type":"string","description":"handler.type='sandbox' için çalıştırılacak JS kodu (network/timeout manifestte bildirilir)."},
      "healthCheck":{"type":"object","description":"Kaydetmeden önce sandbox kodunu denemek için kullanılacak örnek argümanlar."}
    }, ["manifest"]),
    available: (context) => typeof context.services?.skillCreate === 'function',
    execute: async (args, context) => context.services!.skillCreate!(args, context)
  }]
]);

function catalogEntries(): readonly ToolEntry[] {
  return Object.freeze([...CATALOG.values()]);
}
export function getAllowedNvidiaTools(
  agent: ToolAgent,
  context: ToolRuntimeContext,
  // The skills runtime hands back a frozen array of granted permissions, so the
  // scope is any iterable of names rather than a Set specifically.
  options: { readonly allowedPermissions?: Iterable<string> } = {}
): readonly ToolDefinition[] {
  const scope = options.allowedPermissions ? new Set(options.allowedPermissions) : null;
  const output: ToolDefinition[] = [];
  for (const entry of catalogEntries()) {
    if (entry.available && !entry.available(context)) continue;
    if (scope && !scope.has(entry.permission)) continue;
    if (authorize(agent, entry.permission, Boolean(context.approvalGranted)).allowed) output.push(entry.definition);
  }
  return Object.freeze(output);
}
export function getPublicToolRunningActivity(name: unknown): Readonly<{ label: string; state: 'running'; tool: string; timeoutMs: number } | null> {
  const entry = typeof name === 'string' ? CATALOG.get(name) : undefined;
  return entry ? Object.freeze({ label: entry.activity.running, state: 'running' as const, tool: name as string, timeoutMs: entry.timeoutMs }) : null;
}
export function getPublicToolActivity(name: unknown, result: unknown): Readonly<{ label: string; state: 'success' | 'failure'; tool: string; durationMs?: number; error?: string } | null> {
  const entry = typeof name === 'string' ? CATALOG.get(name) : undefined;
  if (!entry) return null;
  const ok = Boolean(result && typeof result === 'object' && (result as { ok?: boolean }).ok === true);
  const value = result && typeof result === 'object' ? result as { durationMs?: unknown; error?: unknown } : {};
  return Object.freeze({
    label: ok ? entry.activity.success : entry.activity.failure,
    state: ok ? 'success' as const : 'failure' as const,
    tool: name as string,
    ...(Number.isFinite(value.durationMs) ? { durationMs: Number(value.durationMs) } : {}),
    ...(typeof value.error === 'string' ? { error: value.error.slice(0, 120) } : {})
  });
}
export async function executeNvidiaToolCall(
  agent: ToolAgent,
  toolCall: unknown,
  context: ToolRuntimeContext
): Promise<ToolExecutionResult> {
  const startedAt = Date.now();
  let normalized;
  try {
    normalized = normalizeToolCall(toolCall);
  } catch (error) {
    return { ok: false, tool: 'unknown', error: sanitizeToolError(error).code, durationMs: Date.now() - startedAt };
  }
  const entry = CATALOG.get(normalized.function.name);
  if (!entry) {
    return { ok: false, tool: normalized.function.name, error: 'UNKNOWN_TOOL', durationMs: Date.now() - startedAt };
  }
  const authorization = authorize(agent, entry.permission, Boolean(context.approvalGranted));
  if (!authorization.allowed) {
    return {
      ok: false,
      tool: entry.definition.function.name,
      error: 'TOOL_NOT_AUTHORIZED',
      reason: authorization.reason,
      durationMs: Date.now() - startedAt
    };
  }
  if (entry.available && !entry.available(context)) {
    return { ok: false, tool: entry.definition.function.name, error: 'TOOL_UNAVAILABLE', durationMs: Date.now() - startedAt };
  }
  let args: Record<string, unknown>;
  try {
    args = parseToolArguments(normalized.function.arguments);
  } catch (error) {
    return { ok: false, tool: entry.definition.function.name, error: sanitizeToolError(error).code, durationMs: Date.now() - startedAt };
  }

  const signal = timeoutSignal(context.signal, entry.timeoutMs);
  const span = context.telemetry?.startSpan('tool.call', { traceId: context.traceId, attributes: { 'tool.name': entry.definition.function.name, 'tool.kind': entry.kind, 'agent.id': context.agent.id } });
  try {
    const value = await entry.execute(args, { ...context, signal });
    const safe = projectSafeToolExecutionResult({ ok: true as const, value });
    if (!safe.ok) {
      span?.end('error', { 'error.code': safe.error });
      return { ok: false, tool: entry.definition.function.name, error: safe.error, durationMs: Date.now() - startedAt };
    }
    span?.end('ok');
    return { ok: true, tool: entry.definition.function.name, value: safe.value, durationMs: Date.now() - startedAt };
  } catch (error) {
    const abortError = abortedReason(signal);
    const safe = sanitizeToolError(error);
    span?.end('error', { 'error.code': abortError || safe.code });
    return {
      ok: false,
      tool: entry.definition.function.name,
      error: abortError || safe.code,
      ...(error && typeof error === 'object' && 'consent' in error && error.consent && typeof error.consent === 'object'
        ? { consentRequest: error.consent as Readonly<Record<string, unknown>> }
        : {}),
      ...(safe.status !== null ? { status: safe.status } : {}),
      durationMs: Date.now() - startedAt
    };
  }
}
export function listToolPermissions(): readonly Readonly<{ name: string; permission: string; kind: ToolKind; timeoutMs: number }>[] {
  return Object.freeze([...CATALOG.entries()].map(([name, entry]) => Object.freeze({
    name,
    permission: entry.permission,
    kind: entry.kind,
    timeoutMs: entry.timeoutMs
  })));
}
export const TOOL_RUNTIME_LIMITS = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  minTimeoutMs: MIN_TIMEOUT_MS,
  maxTimeoutMs: MAX_TIMEOUT_MS,
  catalogSize: CATALOG.size
});
