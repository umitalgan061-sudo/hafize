export interface AccessibilitySnapshot { readonly reducedMotion: boolean; readonly highContrast: boolean; readonly forcedColors: boolean }
interface AccessibilityWindow extends Window { matchMedia: (query: string) => MediaQueryList }
const root = globalThis as AccessibilityWindow;

function matches(windowRef: AccessibilityWindow, query: string): boolean { try { return windowRef.matchMedia(query).matches; } catch { return false; } }
export function readAccessibility(windowRef: AccessibilityWindow = root): AccessibilitySnapshot {
  return Object.freeze({ reducedMotion: matches(windowRef, '(prefers-reduced-motion: reduce)'), highContrast: matches(windowRef, '(prefers-contrast: more)'), forcedColors: matches(windowRef, '(forced-colors: active)') });
}
export function prefersReducedMotion(windowRef: AccessibilityWindow = root): boolean { return readAccessibility(windowRef).reducedMotion; }
export function announce(documentRef: Document, message: string): void {
  let node = documentRef.getElementById('hafizeAccessibilityLiveRegion');
  if (!node) { node = documentRef.createElement('div'); node.id = 'hafizeAccessibilityLiveRegion'; node.className = 'sr-only'; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); node.setAttribute('aria-atomic', 'true'); documentRef.body?.append(node); }
  node.textContent = message.slice(0, 180);
}
