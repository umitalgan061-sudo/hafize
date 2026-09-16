import type { RuntimeCapabilities } from './platform-runtime.ts';

export type PlatformCapability = keyof RuntimeCapabilities;
export type PolicyDecision = 'allowed' | 'fallback' | 'blocked';

export interface CapabilityPolicy {
  readonly id: string;
  readonly requires: readonly PlatformCapability[];
  readonly anyOf?: readonly PlatformCapability[];
  readonly label: string;
  readonly fallback: string;
}

export interface PolicyResult {
  readonly id: string;
  readonly decision: PolicyDecision;
  readonly missing: readonly PlatformCapability[];
  readonly label: string;
  readonly fallback: string;
}

export const PLATFORM_POLICIES: readonly CapabilityPolicy[] = Object.freeze([
  { id: 'local-state', requires: ['storage'], label: 'Yerel durum', fallback: 'Bellek içi durumla devam edilir.' },
  { id: 'persistent-state', requires: ['storage', 'storageEstimate'], label: 'Kalıcı yerel durum', fallback: 'Oturum sonrasında yeniden oluşturulabilir.' },
  { id: 'offline-shell', requires: ['serviceWorker'], label: 'Çevrimdışı uygulama kabuğu', fallback: 'Ağ olmadan yalnızca açık sayfa kullanılabilir.' },
  { id: 'voice-output', requires: ['speechSynthesis'], label: 'Sesli yanıt', fallback: 'Yanıt metin olarak gösterilir.' },
  { id: 'voice-input', requires: ['speechRecognition'], label: 'Sesli giriş', fallback: 'Metin girişi kullanılmalıdır.' },
  { id: 'screen-share', requires: ['screenCapture'], label: 'Ekran paylaşımı', fallback: 'Dosya ekleme veya metin anlatımı kullanılabilir.' },
  { id: 'clipboard', requires: ['clipboard'], label: 'Panoya kopyalama', fallback: 'Metin manuel olarak seçilip kopyalanabilir.' },
  { id: 'trusted-content', requires: ['trustedTypes'], label: 'Trusted Types', fallback: 'DOM üretimi textContent tabanlı kalır.' },
  { id: 'performance-monitoring', requires: ['performanceObserver'], label: 'Performans ölçümü', fallback: 'Temel runtime ölçümleri tutulur.' },
  { id: 'idle-work', requires: ['idleCallback'], label: 'Boşta çalışma', fallback: 'Zamanlayıcı tabanlı düşük öncelikli iş kullanılır.' },
  { id: 'modern-streaming', requires: [], anyOf: ['webTransport', 'serviceWorker'], label: 'Modern bağlantı yardımcıları', fallback: 'Mevcut HTTP akışı korunur.' }
]);

export function evaluatePolicy(policy: CapabilityPolicy, capabilities: RuntimeCapabilities): PolicyResult {
  const missing = policy.requires.filter((name) => !capabilities[name]);
  const anySatisfied = policy.anyOf?.some((name) => capabilities[name]) ?? true;
  const blockedByRequired = missing.length > 0;
  const decision: PolicyDecision = !blockedByRequired && anySatisfied ? 'allowed' : 'fallback';
  return Object.freeze({ id: policy.id, decision, missing: Object.freeze(missing), label: policy.label, fallback: policy.fallback });
}

export function evaluatePolicies(capabilities: RuntimeCapabilities): readonly PolicyResult[] {
  return Object.freeze(PLATFORM_POLICIES.map((policy) => evaluatePolicy(policy, capabilities)));
}

export function policyFor(id: string): CapabilityPolicy | null {
  return PLATFORM_POLICIES.find((policy) => policy.id === id) ?? null;
}
