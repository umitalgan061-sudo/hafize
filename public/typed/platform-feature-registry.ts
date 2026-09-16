import { hafizePlatform, type PlatformFeature, type PlatformFeatureContext } from './platform-runtime.ts';

export interface FeatureAdapter { readonly id: string; readonly readyEvent?: string; readonly globalName?: string }

export const FEATURE_ADAPTERS: readonly FeatureAdapter[] = Object.freeze([
  { id: 'application-runtime', globalName: 'HafizePlatformRuntime' },
  { id: 'prompt-library', globalName: 'HafizePromptLibrary' },
  { id: 'prompt-smart-fill', globalName: 'HafizePromptLibrarySmartFill' },
  { id: 'prompt-command-palette', globalName: 'PromptLibraryCommandPalette' },
  { id: 'scheduled-task-countdown', globalName: 'HafizeScheduledTasksCountdown' },
  { id: 'voice-output', globalName: 'HafizeVoiceOutput' },
  { id: 'hands-free', globalName: 'HafizeHandsFree' },
  { id: 'screen-share', globalName: 'HafizeScreenShare' },
  { id: 'workspace-navigation', globalName: 'HafizeWorkspaceNavigation' }
]);

function existingGlobal(name: string): unknown { try { return (globalThis as Record<string, unknown>)[name]; } catch { return undefined; } }

function adapterFeature(adapter: FeatureAdapter): PlatformFeature {
  return {
    id: adapter.id,
    priority: adapter.id === 'application-runtime' ? 100 : 50,
    start: ({ addMetric }: PlatformFeatureContext) => {
      const started = performance.now();
      const instance = adapter.globalName ? existingGlobal(adapter.globalName) : undefined;
      if (!instance && adapter.globalName) {
        addMetric({ name: 'event', value: performance.now() - started, detail: `feature-missing:${adapter.id}` });
        return () => undefined;
      }
      addMetric({ name: 'event', value: performance.now() - started, detail: `feature-ready:${adapter.id}` });
      return () => undefined;
    }
  };
}

export function registerKnownFeatures(): void {
  for (const adapter of FEATURE_ADAPTERS) {
    if (!hafizePlatform.snapshot().featureStates[adapter.id]) hafizePlatform.addFeature(adapterFeature(adapter));
  }
}

if (typeof document !== 'undefined') {
  const boot = (): void => { registerKnownFeatures(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
}
