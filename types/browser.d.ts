// Hafize'nin tarayıcı tarafındaki global yüzeyi.
//
// `public/` altındaki her modül UMD benzeri bir sarmalayıcı ile kendini
// `window` üzerine yazar; bu dosya o sözleşmeyi tek yerde toplar. Buradaki
// bildirimler çalışma zamanına hiçbir şey eklemez, yalnızca tip denetleyicisine
// hangi global'in var olduğunu ve neye benzediğini söyler.
//
// Yeni bir `public/*.js` modülü global yayınlıyorsa girdisi buraya eklenir;
// aksi hâlde `npm run typecheck` onu bilinmeyen özellik olarak reddeder.

export {};

/** Sohbet yanıtlarını markdown olarak ayrıştıran saf katman. */
interface HafizeMarkdownApi {
  readonly LIMITS: Readonly<Record<string, number>>;
  readonly SAFE_SCHEMES: readonly string[];
  normalizeSource(value: unknown): string;
  safeUrl(value: unknown): string;
  hasMarkdown(value: unknown): boolean;
  parseInline(text: string, state?: unknown, depth?: number): unknown[];
  parseMarkdown(value: unknown): { blocks: unknown[]; truncated: boolean; source: string };
  toPlainText(value: unknown): string;
  renderMarkdownInto(
    container: Element | null,
    value: unknown,
    options?: { document?: Document; placeholder?: string }
  ): { rendered: boolean; truncated: boolean; blocks: number };
  renderPlainInto(
    container: Element | null,
    value: unknown,
    options?: { document?: Document; placeholder?: string }
  ): boolean;
  sourceFor(container: Element | null | undefined): string;
}

/** Sohbet yüzeyi ile markdown katmanı arasındaki köprü. */
interface HafizeChatMarkdownApi {
  readonly COPY_FEEDBACK_MS: number;
  paint(
    container: Element | null,
    text: unknown,
    options?: { placeholder?: string; plain?: boolean; streaming?: boolean }
  ): { rendered: boolean } | null;
  sourceFor(container: Element | null | undefined): string;
  plainTextFor(container: Element | null | undefined): string;
  copyText(text: string): Promise<boolean>;
  codeTextFor(button: Element | null | undefined): string;
  init(messagesNode?: Element | null): boolean;
}

/** Service worker önbellek politikası; hem sayfada hem worker'da yüklenir. */
interface HafizeSwPolicyApi {
  readonly CACHE_PREFIX: string;
  readonly CURRENT_CACHE: string;
  readonly SHELL_ASSETS: readonly string[];
  classifyRequest(request: Request, origin: string): 'navigation' | 'shell' | 'network-only' | 'ignore';
  isSameOriginUrl(url: string, origin: string): boolean;
  shouldDeleteCache(cacheName: unknown): boolean;
}

/**
 * Henüz ayrıntılı sözleşmesi yazılmamış global'ler.
 *
 * `unknown` yerine bilerek geniş bir kayıt kullanılır: modül gerçekten
 * yüklenmemiş olabileceği için çağıran taraf zaten isteğe bağlı zincirleme
 * (`?.`) ile erişir. Bir modülün sözleşmesi yukarıdaki gibi yazıldıkça bu
 * listeden çıkarılır.
 */
type HafizeLooseModule = Record<string, unknown> | undefined;

declare global {

  /**
   * Prompt kütüphanesi kaydı.
   *
   * `public/prompt-library.js` kayıtları `localStorage` içinde tutar ve sürümler
   * arasında alan ekler; bu yüzden bilinen alanların yanında bir dizin imzası
   * taşır. İmza aynı zamanda tipin `HafizeLooseModule` tüketicilerine
   * atanabilir kalmasını sağlar.
   */
  interface HafizePromptRecord {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly useCount?: number;
    readonly favorite?: boolean;
    readonly tags?: readonly string[];
    readonly updatedAt?: string;
    readonly [key: string]: unknown;
  }

  /** `public/prompt-library.js` yüzeyinin tiplenmiş modüllerce kullanılan kısmı. */
  interface HafizePromptLibraryApi {
    readonly STORAGE_KEY?: string;
    readonly loadItems?: (storage: Storage) => HafizePromptRecord[];
    readonly saveItems?: (storage: Storage, items: HafizePromptRecord[]) => boolean;
    readonly normalizeItem?: (value: HafizePromptRecord) => HafizePromptRecord | null;
    readonly extractVariables?: (body: string) => string[];
    readonly replaceVariables?: (body: string, values: Record<string, string>) => string;
    readonly [key: string]: unknown;
  }

  /** `public/prompt-library-smart-fill.ts` denetleyicisi. */
  interface HafizeSmartFillController {
    readonly mounted: true;
    readonly open: (prompt: HafizePromptRecord) => void;
    readonly close: () => void;
    readonly destroy: () => void;
  }

  /** `public/prompt-library-command-palette.ts` denetleyicisi. */
  interface HafizePaletteController {
    readonly mounted: true;
    readonly open: (start: number) => void;
    readonly close: () => void;
    readonly search: (query: string) => HafizePromptRecord[];
    readonly destroy: () => void;
  }

  interface Window {
    HafizeMarkdown?: HafizeMarkdownApi;
    HafizeChatMarkdown?: HafizeChatMarkdownApi;
    HafizeSwPolicy?: HafizeSwPolicyApi;

    HafizeAuth?: HafizeLooseModule;
    HafizeComposerHistory?: HafizeLooseModule;
    HafizeComposerHistoryBackup?: HafizeLooseModule;
    HafizeComposerHistoryController?: HafizeLooseModule;
    HafizeComposerHistoryHelp?: HafizeLooseModule;
    HafizeComposerHistoryPanel?: HafizeLooseModule;
    HafizeComposerHistorySettings?: HafizeLooseModule;
    HafizeConversationWorkspace?: HafizeLooseModule;
    HafizeConversationWorkspaceKeyboard?: HafizeLooseModule;
    HafizeHandsFree?: HafizeLooseModule;
    HafizeHandsFreeBackgroundGuard?: HafizeLooseModule;
    HafizeMessageWorkspacePolicy?: HafizeLooseModule;
    HafizePromptLibrary?: HafizePromptLibraryApi;
    HafizePromptLibrarySmartFill?: {
      readonly STORAGE_KEY: string;
      readonly mount: () => HafizeSmartFillController | null;
      readonly open?: (item: HafizePromptRecord) => void;
    };
    HafizePromptLibraryStarters?: HafizeLooseModule;
    HafizePromptLibraryUsage?: HafizeLooseModule;
    HafizePromptSmartFillHints?: {
      readonly mount: () => void;
      readonly paint: (panel: HTMLElement) => void;
    };
    HafizeScreenShare?: HafizeLooseModule;
    HafizeSettingsWorkspace?: HafizeLooseModule;
    HafizeUiShell?: HafizeLooseModule;
    HafizeVoiceInput?: HafizeLooseModule;
    HafizeVoiceOutput?: HafizeLooseModule;
    HafizeWorkspaceNavigation?: HafizeLooseModule;

    // `Hafize` ön ekini taşımayan iki tarihsel ad.
    PromptLibraryCommandPalette?: {
      readonly mount: () => HafizePaletteController | null;
      readonly results: (query: string) => HafizePromptRecord[];
    };
    ScheduledTaskCountdown?: {
      readonly label: (timestamp: string) => string;
      readonly refresh: () => void;
      readonly start: () => void;
      readonly stop: () => void;
    };
  }

  /**
   * UMD sarmalayıcıları `module` varlığını yoklar; tarayıcıda tanımsızdır.
   * Bildirilmemesi hâlinde her sarmalayıcı satırı tip hatası üretirdi.
   */
  const module: { exports?: unknown } | undefined;

  /** PWA kurulum istemi henüz standart `lib.dom` içinde değildir. */
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: readonly string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
  }

  /**
   * Modüller arası `hafize:*` olayları.
   *
   * `public/` altındaki modüller birbirini doğrudan çağırmaz; gevşek bağlı
   * kalmak için pencere olayı yayınlarlar. Burada bildirilmesi, dinleyen
   * tarafın `event.detail` içinden hangi alanı okuyabileceğini sabitler.
   */
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    'hafize:edit-message': CustomEvent<{ messageId?: string }>;
    'hafize:composer-history-changed': CustomEvent<unknown>;
    'hafize:composer-history-settings-changed': CustomEvent<unknown>;
    'hafize:conversation-workspace-changed': CustomEvent<unknown>;
    'hafize:prompt-command-inserted': CustomEvent<unknown>;
    'hafize:prompt-library-state-changed': CustomEvent<unknown>;
    'hafize:screen-capture-ready': CustomEvent<unknown>;
  }
}
