export interface InstallPromptEvent extends Event { readonly prompt: () => Promise<void>; readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed'; }>; }
export interface PwaManager { readonly isInstallable: () => boolean; readonly promptInstall: () => Promise<boolean>; readonly isStandalone: () => boolean; readonly registerServiceWorker: (script?: string) => Promise<ServiceWorkerRegistration | null>; readonly destroy: () => void; }
interface PwaWindow extends Window { __hafizeInstallEvent?: InstallPromptEvent; }

export function isStandalone(windowRef: Window = window): boolean { return windowRef.matchMedia?.('(display-mode: standalone)').matches === true || Boolean((windowRef.navigator as Navigator & { standalone?: boolean }).standalone); }
export function supportsInstallPrompt(value: unknown): value is InstallPromptEvent { return Boolean(value && typeof (value as InstallPromptEvent).prompt === 'function' && 'userChoice' in (value as object)); }
export async function registerServiceWorker(script = '/sw.js', navigatorRef: Navigator = navigator): Promise<ServiceWorkerRegistration | null> { if (!('serviceWorker' in navigatorRef)) return null; try { return await navigatorRef.serviceWorker.register(script, { scope: '/' }); } catch { return null; } }

export function installPwaManager(documentRef: Document = document, windowRef: PwaWindow = globalThis as PwaWindow): PwaManager {
  let installEvent: InstallPromptEvent | null = null;
  let destroyed = false;
  const installButton = documentRef.getElementById('installBtn') as HTMLButtonElement | null;
  const onBeforeInstall = (event: Event): void => { if (!supportsInstallPrompt(event)) return; event.preventDefault(); installEvent = event; windowRef.__hafizeInstallEvent = event; if (installButton) { installButton.hidden = false; installButton.disabled = false; } };
  const onInstalled = (): void => { installEvent = null; delete windowRef.__hafizeInstallEvent; if (installButton) { installButton.hidden = true; installButton.disabled = true; } };
  const onClick = async (): Promise<void> => { if (destroyed || !installEvent) return; const current = installEvent; installEvent = null; try { await current.prompt(); await current.userChoice; } catch { /* prompt was dismissed or unavailable */ } if (installButton) installButton.hidden = true; };
  windowRef.addEventListener('beforeinstallprompt', onBeforeInstall); windowRef.addEventListener('appinstalled', onInstalled); installButton?.addEventListener('click', onClick);
  if (installButton && isStandalone(windowRef)) { installButton.hidden = true; installButton.disabled = true; }
  void registerServiceWorker();
  return Object.freeze({ isInstallable: () => Boolean(installEvent), promptInstall: async () => { if (!installEvent) return false; const current = installEvent; installEvent = null; try { await current.prompt(); return (await current.userChoice).outcome === 'accepted'; } catch { return false; } }, isStandalone: () => isStandalone(windowRef), registerServiceWorker, destroy: () => { destroyed = true; windowRef.removeEventListener('beforeinstallprompt', onBeforeInstall); windowRef.removeEventListener('appinstalled', onInstalled); installButton?.removeEventListener('click', onClick); } });
}

export const HafizePwaManager = Object.freeze({ isStandalone, supportsInstallPrompt, registerServiceWorker, installPwaManager });
const boot = (): void => { void installPwaManager(); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
