export type MigrationStatus = 'legacy' | 'typed' | 'fallback' | 'failed';
export interface MigrationEntry { readonly id: string; readonly legacyPath?: string; readonly typedPath: string; readonly status: MigrationStatus; readonly loadedAt?: string; readonly error?: string; }
export interface MigrationRegistry { readonly register: (entry: Omit<MigrationEntry, 'loadedAt'>) => void; readonly markLoaded: (id: string) => void; readonly markFailed: (id: string, error: unknown) => void; readonly markFallback: (id: string, reason?: string) => void; readonly list: () => readonly MigrationEntry[]; readonly summary: () => { readonly total: number; readonly typed: number; readonly legacy: number; readonly fallback: number; readonly failed: number }; readonly reset: () => void; }
interface RegistryRoot extends Window { HafizeTypedRuntime?: { readonly migrations?: MigrationRegistry }; }

const root = globalThis as RegistryRoot;
const MAX_ENTRIES = 64;
const MAX_TEXT = 240;
const entries = new Map<string, MigrationEntry>();
const clamp = (value: unknown, max: number): string => typeof value === 'string' ? value.slice(0, max) : '';
const safeId = (value: unknown): string => clamp(value, 80).trim().replace(/[^a-zA-Z0-9._-]/g, '-') || 'unknown';

function register(entry: Omit<MigrationEntry, 'loadedAt'>): void {
  const id = safeId(entry.id);
  const normalized: MigrationEntry = Object.freeze({ id, ...(entry.legacyPath ? { legacyPath: clamp(entry.legacyPath, 160) } : {}), typedPath: clamp(entry.typedPath, 160), status: entry.status, ...(entry.error ? { error: clamp(entry.error, MAX_TEXT) } : {}) });
  if (!normalized.typedPath) return;
  entries.set(id, normalized);
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
}
function update(id: string, patch: Partial<MigrationEntry>): void { const current = entries.get(safeId(id)); if (!current) return; entries.set(current.id, Object.freeze({ ...current, ...patch })); }
function markLoaded(id: string): void { update(id, { status: 'typed', loadedAt: new Date().toISOString(), error: undefined }); }
function markFailed(id: string, error: unknown): void { const message = error instanceof Error ? error.message : String(error); update(id, { status: 'failed', error: clamp(message, MAX_TEXT) }); }
function markFallback(id: string, reason?: string): void { update(id, { status: 'fallback', ...(reason ? { error: clamp(reason, MAX_TEXT) } : {}) }); }
function list(): readonly MigrationEntry[] { return Object.freeze([...entries.values()]); }
function summary(): { readonly total: number; readonly typed: number; readonly legacy: number; readonly fallback: number; readonly failed: number } { const values = [...entries.values()]; return Object.freeze({ total: values.length, typed: values.filter((item) => item.status === 'typed').length, legacy: values.filter((item) => item.status === 'legacy').length, fallback: values.filter((item) => item.status === 'fallback').length, failed: values.filter((item) => item.status === 'failed').length }); }
function reset(): void { entries.clear(); }

export const HafizeMigrationRegistry: MigrationRegistry = Object.freeze({ register, markLoaded, markFailed, markFallback, list, summary, reset });
root.HafizeTypedRuntime = Object.freeze({ migrations: HafizeMigrationRegistry });

export interface TypedModuleDescriptor { readonly id: string; readonly typedPath: string; readonly legacyPath?: string; readonly enabled: boolean; }
export const DEFAULT_MIGRATIONS: readonly TypedModuleDescriptor[] = Object.freeze([
  { id: 'chat-composer', typedPath: '/typed-build/chat-composer-features.js', legacyPath: '/chat-composer-features.js', enabled: true },
  { id: 'chat-drafts', typedPath: '/typed-build/chat-drafts.js', legacyPath: '/chat-drafts.js', enabled: true },
  { id: 'chat-history-search', typedPath: '/typed-build/chat-history-search.js', legacyPath: '/chat-history-search.js', enabled: true },
  { id: 'chat-history-export', typedPath: '/typed-build/chat-history-export.js', legacyPath: '/chat-history-export.js', enabled: true },
  { id: 'chat-history-management', typedPath: '/typed-build/chat-history-management.js', legacyPath: '/chat-history-management.js', enabled: true },
  { id: 'prompt-library', typedPath: '/typed-build/prompt-library-keyboard.js', legacyPath: '/prompt-library.js', enabled: true },
  { id: 'scheduled-tasks', typedPath: '/typed-build/scheduled-tasks.js', legacyPath: '/scheduled-tasks.js', enabled: true },
  { id: 'settings', typedPath: '/typed-build/settings-workspace.js', legacyPath: '/settings-workspace.js', enabled: true },
  { id: 'voice-input', typedPath: '/typed-build/voice-input.js', legacyPath: '/voice-input.js', enabled: true },
  { id: 'voice-output', typedPath: '/typed-build/voice-output.js', legacyPath: '/voice-output.js', enabled: true },
  { id: 'workspace-navigation', typedPath: '/typed-build/workspace-navigation.js', legacyPath: '/workspace-navigation.js', enabled: true },
  { id: 'ui-shell', typedPath: '/typed-build/ui-shell.js', legacyPath: '/ui-shell.js', enabled: true }
]);

DEFAULT_MIGRATIONS.forEach((entry) => register({ ...entry, status: entry.enabled ? 'typed' : 'legacy' }));
