import { normalizeCalendarItems, normalizeCalendarRead } from './calendar-contract.ts';

export interface CalendarReadSource { read(input: unknown): unknown | Promise<unknown> }
export interface CalendarReadRuntimeOptions { ownerId?: unknown; source?: CalendarReadSource }
export interface CalendarReadQuery { from?: unknown; to?: unknown; kind?: unknown; query?: unknown }

const MAX_CACHED_ITEMS = 1_000;

function clone(item: Record<string, unknown>): Record<string, unknown> { return { ...item }; }

export function createCalendarReadRuntime({ ownerId, source }: CalendarReadRuntimeOptions = {}) {
  const safeOwner = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!safeOwner) throw new Error('INVALID_CALENDAR_RUNTIME_OWNER');
  if (typeof source?.read !== 'function') throw new Error('INVALID_CALENDAR_RUNTIME_SOURCE');
  const cache: Record<string, unknown>[] = [];

  async function refresh(query: CalendarReadQuery = {}) {
    const request = normalizeCalendarRead({ ownerId: safeOwner, query });
    const result: any = await source.read(request);
    const normalized = normalizeCalendarItems({ ownerId: safeOwner, items: Array.isArray(result) ? result : result?.items || [] });
    cache.length = 0;
    cache.push(...normalized.items.slice(0, MAX_CACHED_ITEMS));
    return Object.freeze(cache.map(clone));
  }

  function list(query: CalendarReadQuery = {}) {
    const request = normalizeCalendarRead({ ownerId: safeOwner, query });
    const { from, to, kind, query: text } = request.query;
    const normalizedText = typeof text === 'string' ? text.toLocaleLowerCase('tr-TR') : '';
    return Object.freeze(cache
      .filter((item: any) => (!from || item.date >= from) && (!to || item.date <= to))
      .filter((item: any) => !kind || item.kind === kind)
      .filter((item: any) => !normalizedText || `${item.title} ${item.description || ''}`.toLocaleLowerCase('tr-TR').includes(normalizedText))
      .map(clone));
  }

  return Object.freeze({ refresh, list, size: (): number => cache.length });
}
