import { normalizeCalendarItems, normalizeCalendarRead } from './calendar-contract.mjs';

const MAX_CACHED_ITEMS = 1_000;

function clone(item) {
  return { ...item };
}

export function createCalendarReadRuntime({ ownerId, source }) {
  const safeOwner = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!safeOwner) throw new Error('INVALID_CALENDAR_RUNTIME_OWNER');
  if (typeof source?.read !== 'function') throw new Error('INVALID_CALENDAR_RUNTIME_SOURCE');
  const cache = [];

  async function refresh(query = {}) {
    const request = normalizeCalendarRead({ ownerId: safeOwner, query });
    const result = await source.read(request);
    const normalized = normalizeCalendarItems({ ownerId: safeOwner, items: Array.isArray(result) ? result : result?.items || [] });
    cache.length = 0;
    cache.push(...normalized.items.slice(0, MAX_CACHED_ITEMS));
    return Object.freeze(cache.map(clone));
  }

  function list(query = {}) {
    const request = normalizeCalendarRead({ ownerId: safeOwner, query });
    const { from, to, kind, query: text } = request.query;
    const normalizedText = typeof text === 'string' ? text.toLocaleLowerCase('tr-TR') : '';
    return Object.freeze(cache
      .filter((item) => (!from || item.date >= from) && (!to || item.date <= to))
      .filter((item) => !kind || item.kind === kind)
      .filter((item) => !normalizedText || `${item.title} ${item.description || ''}`.toLocaleLowerCase('tr-TR').includes(normalizedText))
      .map(clone));
  }

  return Object.freeze({ refresh, list, size: () => cache.length });
}
