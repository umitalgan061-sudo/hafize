export interface RedactedError { readonly source: string; readonly name: string; readonly message: string; readonly stackPresent: boolean; readonly at: string }
export interface ErrorBoundaryController { readonly capture: (error: unknown, source?: string) => RedactedError; readonly destroy: () => void }
interface ErrorWindow extends Window { readonly HafizeErrorBoundary?: ErrorBoundaryController }
const root = globalThis as ErrorWindow;
const MAX_MESSAGE = 220;
const SECRET_PATTERNS = [/bearer\s+[a-z0-9._-]+/gi, /token\s*[=:]\s*[^\s&]+/gi, /api[_-]?key\s*[=:]\s*[^\s&]+/gi, /password\s*[=:]\s*[^\s&]+/gi, /secret\s*[=:]\s*[^\s&]+/gi];

export function redactMessage(value: unknown): string {
  let message = value instanceof Error ? value.message : String(value ?? 'Unknown error');
  for (const pattern of SECRET_PATTERNS) message = message.replace(pattern, '[REDACTED]');
  return message.replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE);
}
export function toRedactedError(error: unknown, source = 'runtime'): RedactedError {
  return Object.freeze({ source: redactMessage(source).slice(0, 60) || 'runtime', name: error instanceof Error ? error.name.slice(0, 80) : 'UnknownError', message: redactMessage(error), stackPresent: error instanceof Error ? Boolean(error.stack) : false, at: new Date().toISOString() });
}
export function installErrorBoundary(windowRef: ErrorWindow = root): ErrorBoundaryController {
  const listeners: Array<() => void> = [];
  const capture = (error: unknown, source = 'runtime'): RedactedError => {
    const redacted = toRedactedError(error, source);
    windowRef.dispatchEvent(new CustomEvent('hafize:diagnostic-error', { detail: redacted }));
    return redacted;
  };
  const onError = (event: ErrorEvent): void => { capture(event.error ?? event.message, 'window'); };
  const onRejection = (event: PromiseRejectionEvent): void => { capture(event.reason, 'promise'); };
  windowRef.addEventListener('error', onError); windowRef.addEventListener('unhandledrejection', onRejection);
  listeners.push(() => windowRef.removeEventListener('error', onError), () => windowRef.removeEventListener('unhandledrejection', onRejection));
  const controller: ErrorBoundaryController = Object.freeze({ capture, destroy: () => listeners.splice(0).forEach((remove) => remove()) });
  windowRef.HafizeErrorBoundary = controller;
  return controller;
}

export const hafizeErrorBoundary = installErrorBoundary();
