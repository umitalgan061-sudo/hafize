(function exposeMessageWorkspacePolicy(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeMessageWorkspacePolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createPolicy() {
  'use strict';

  const MAX_RECORDS = 240;
  const MAX_NOTE = 600;
  const MAX_TAG = 24;
  const MAX_TAGS = 8;
  const MAX_QUERY = 120;
  const MAX_EXPORT = 100;
  const VALID_FEEDBACK = new Set(['up', 'down', '']);
  const VALID_FILTERS = new Set(['all', 'saved', 'feedback', 'notes', 'user', 'assistant', 'tag']);
  const VALID_SORTS = new Set(['newest', 'oldest', 'feedback', 'notes']);

  function text(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function tag(value) {
    // Etiket işaretleri atıldıktan sonra kalan boşluk da temizlenir:
    // "### proje" -> "proje".
    return text(text(value).replace(/^#+/, '')).slice(0, MAX_TAG);
  }

  function note(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTE);
  }

  function feedback(value) {
    return VALID_FEEDBACK.has(value) ? value : '';
  }

  function iso(value, fallback = new Date().toISOString()) {
    const date = new Date(value || '');
    return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
  }

  function normalizeRecord(value) {
    if (!value || typeof value !== 'object') return null;
    const conversationId = typeof value.conversationId === 'string' ? value.conversationId.trim().slice(0, 120) : '';
    const messageId = typeof value.messageId === 'string' ? value.messageId.trim().slice(0, 120) : '';
    if (!conversationId || !messageId) return null;
    const tags = Array.isArray(value.tags)
      ? [...new Set(value.tags.map(tag).filter(Boolean))].slice(0, MAX_TAGS)
      : [];
    return Object.freeze({
      id: typeof value.id === 'string' && value.id ? value.id.slice(0, 120) : `${conversationId}:${messageId}`,
      conversationId,
      messageId,
      saved: value.saved === true,
      feedback: feedback(value.feedback),
      note: note(value.note),
      tags,
      createdAt: iso(value.createdAt),
      updatedAt: iso(value.updatedAt)
    });
  }

  function normalizeRecords(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const records = [];
    for (const item of value) {
      const record = normalizeRecord(item);
      if (!record || seen.has(record.id)) continue;
      seen.add(record.id);
      if (!record.saved && !record.feedback && !record.note && !record.tags.length) continue;
      records.push(record);
      if (records.length >= MAX_RECORDS) break;
    }
    return records;
  }

  function normalizeState(value) {
    const object = value && typeof value === 'object' ? value : {};
    return {
      query: typeof object.query === 'string' ? text(object.query).toLocaleLowerCase('tr-TR').slice(0, MAX_QUERY) : '',
      filter: VALID_FILTERS.has(object.filter) ? object.filter : 'all',
      sort: VALID_SORTS.has(object.sort) ? object.sort : 'newest',
      selected: Array.isArray(object.selected)
        ? [...new Set(object.selected.filter((id) => typeof id === 'string').slice(0, MAX_EXPORT))]
        : []
    };
  }

  function canExport(records, selectedIds) {
    const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
    return normalizeRecords(records).filter((record) => selected.has(record.id)).slice(0, MAX_EXPORT);
  }

  function searchableText(item) {
    if (!item || typeof item !== 'object') return '';
    return text([item.content, item.note, ...(Array.isArray(item.tags) ? item.tags : [])].filter(Boolean).join(' ')).toLocaleLowerCase('tr-TR').slice(0, 12000);
  }

  function matches(item, state) {
    if (!item || !item.record) return false;
    const record = item.record;
    if (state.filter === 'saved' && !record.saved) return false;
    if (state.filter === 'feedback' && !record.feedback) return false;
    if (state.filter === 'notes' && !record.note) return false;
    if (state.filter === 'tag' && !record.tags.length) return false;
    if (state.filter === 'user' && item.role !== 'user') return false;
    if (state.filter === 'assistant' && item.role !== 'assistant') return false;
    if (state.query && !searchableText({ content: item.content, note: record.note, tags: record.tags }).includes(state.query)) return false;
    return true;
  }

  function sort(records, mode) {
    const list = [...records];
    list.sort((a, b) => {
      if (mode === 'oldest') return a.updatedAt.localeCompare(b.updatedAt);
      if (mode === 'feedback') return Number(Boolean(b.feedback)) - Number(Boolean(a.feedback)) || b.updatedAt.localeCompare(a.updatedAt);
      if (mode === 'notes') return Number(Boolean(b.note)) - Number(Boolean(a.note)) || b.updatedAt.localeCompare(a.updatedAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return list;
  }

  function createPatch(record, patch) {
    const next = { ...record, ...patch, updatedAt: new Date().toISOString() };
    return normalizeRecord(next);
  }

  function toggleSaved(record) {
    return createPatch(record, { saved: !record.saved });
  }

  function toggleFeedback(record, value) {
    const next = record.feedback === value ? '' : feedback(value);
    return createPatch(record, { feedback: next });
  }

  function replaceNote(record, value) {
    return createPatch(record, { note: note(value) });
  }

  function replaceTags(record, values) {
    return createPatch(record, { tags: [...new Set((Array.isArray(values) ? values : String(values ?? '').split(',')).map(tag).filter(Boolean))].slice(0, MAX_TAGS) });
  }

  function isEmpty(record) {
    return !record || (!record.saved && !record.feedback && !record.note && !record.tags.length);
  }

  return Object.freeze({
    MAX_RECORDS,
    MAX_NOTE,
    MAX_TAG,
    MAX_TAGS,
    MAX_QUERY,
    MAX_EXPORT,
    text,
    tag,
    note,
    feedback,
    normalizeRecord,
    normalizeRecords,
    normalizeState,
    canExport,
    searchableText,
    matches,
    sort,
    createPatch,
    toggleSaved,
    toggleFeedback,
    replaceNote,
    replaceTags,
    isEmpty
  });
});
