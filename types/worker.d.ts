// Service worker global'leri.
//
// `public/sw.js` bir modül değil, klasik bir worker script'idir; bağımlılığını
// `importScripts` ile yükler. Bu bildirim o sözleşmeyi tip denetleyicisine
// tanıtır ve `sw-policy.js` API'sinin worker içinde de aynı şekli taşıdığını
// sabitler.

export {};

declare global {
  function importScripts(...urls: string[]): void;

  interface HafizeSwPolicyContract {
    readonly CACHE_PREFIX: string;
    readonly CURRENT_CACHE: string;
    readonly SHELL_ASSETS: readonly string[];
    classifyRequest(request: Request, origin: string): 'navigation' | 'shell' | 'network-only' | 'ignore';
    isSameOriginUrl(url: string, origin: string): boolean;
    shouldDeleteCache(cacheName: unknown): boolean;
  }

  interface ServiceWorkerGlobalScope {
    HafizeSwPolicy: HafizeSwPolicyContract;
  }

  interface WorkerGlobalScope {
    HafizeSwPolicy: HafizeSwPolicyContract;
  }

  /** UMD sarmalayıcıları `module` varlığını yoklar; worker'da tanımsızdır. */
  const module: { exports?: unknown } | undefined;
}
