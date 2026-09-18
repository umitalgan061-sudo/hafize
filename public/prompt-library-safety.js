(function installPromptLibrarySafety(root) {
  'use strict';

  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const MAX_IMPORT_BYTES = 1_000_000;
  const MAX_ITEMS = 120;
  const MAX_PREVIEW = 8;
  const MAX_ID = 120;

  const api = root.HafizePromptLibrary;
  const collectionsApi = root.HafizePromptLibraryCollections;
  const revisionsApi = root.HafizePromptLibraryRevisions;

  const randomId = () => root.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clip = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

  function readJson(storage, key, fallback) {
    try {
      const raw = storage?.getItem?.(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    try {
      storage?.setItem?.(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function readRawPrompts(storage = root.localStorage) {
    try {
      const raw = storage?.getItem?.(PROMPT_KEY);
      return { raw, parsed: raw ? JSON.parse(raw) : [] };
    } catch (error) {
      return { raw: storage?.getItem?.(PROMPT_KEY) || '', parsed: null, error };
    }
  }

  function payloadItems(payload) {
    if (Array.isArray(payload)) return payload;
    return payload && typeof payload === 'object' && Array.isArray(payload.items) ? payload.items : [];
  }

  function normalizeIncoming(payload) {
    const source = payloadItems(payload);
    const normalized = [];
    const invalid = [];
    const ids = new Set();
    let duplicateIds = 0;

    for (const raw of source.slice(0, MAX_ITEMS * 2)) {
      const item = api?.normalizeItem?.(raw);
      if (!item) {
        invalid.push(raw);
        continue;
      }
      if (ids.has(item.id)) {
        duplicateIds += 1;
        normalized.push({ item, duplicate: true });
      } else {
        normalized.push({ item, duplicate: false });
        ids.add(item.id);
      }
    }
    return { sourceCount: source.length, normalized, invalidCount: invalid.length, duplicateIds };
  }

  function buildImportPlan(payload, currentItems = [], options = {}) {
    const current = api?.normalizeCollection?.(currentItems) || [];
    const incoming = normalizeIncoming(payload);
    const ids = new Set(current.map((item) => item.id));
    const accepted = [];
    let collisions = 0;
    let capacitySkipped = 0;

    for (const entry of incoming.normalized) {
      if (accepted.length + current.length >= MAX_ITEMS) {
        capacitySkipped += 1;
        continue;
      }
      let item = entry.item;
      let nextId = item.id;
      while (ids.has(nextId)) {
        collisions += 1;
        nextId = randomId();
      }
      if (nextId !== item.id) item = Object.freeze({ ...item, id: nextId });
      ids.add(item.id);
      accepted.push(item);
    }

    const preview = accepted.slice(0, options.previewLimit || MAX_PREVIEW).map((item) => ({
      id: item.id,
      title: clip(item.title, 100),
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
      bodyPreview: String(item.body || '').replace(/\s+/g, ' ').slice(0, 140),
      rekeyed: current.some((candidate) => candidate.id === item.id) === false
    }));

    return {
      version: 1,
      currentCount: current.length,
      sourceCount: incoming.sourceCount,
      validCount: incoming.normalized.length,
      invalidCount: incoming.invalidCount,
      duplicateIds: incoming.duplicateIds,
      collisions,
      acceptedCount: accepted.length,
      capacitySkipped,
      preview,
      items: accepted,
      meta: payload && typeof payload === 'object' ? {
        source: clip(payload.source, 80),
        exportedAt: clip(payload.exportedAt, 40)
      } : {}
    };
  }

  function freshCurrent(storage = root.localStorage) {
    return api?.loadItems?.(storage) || [];
  }

  function applyImportPlan(plan, storage = root.localStorage) {
    if (!plan || !Array.isArray(plan.items)) return { imported: 0, skipped: 0, ok: false, reason: 'INVALID_PLAN' };
    const merged = api?.mergeImportedItems?.(freshCurrent(storage), plan.items);
    if (!merged) return { imported: 0, skipped: plan.items.length, ok: false, reason: 'MERGE_FAILED' };
    const ok = api?.saveItems?.(storage, merged.items) === true;
    if (!ok) return { imported: 0, skipped: plan.items.length, ok: false, reason: 'STORAGE_FAILED' };
    try {
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-changed'));
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-safety-changed'));
    } catch {}
    return { imported: merged.imported, skipped: plan.items.length - merged.imported, ok: true, reason: '' };
  }

  function analyzeCollections(storage = root.localStorage, promptIds = new Set()) {
    const raw = readJson(storage, COLLECTION_KEY, []);
    const collections = collectionsApi?.normalizeCollections?.(raw);
    const list = Array.isArray(collections) ? collections : [];
    const ids = new Set();
    let duplicateIds = 0;
    let orphanMembers = 0;
    for (const collection of list) {
      if (ids.has(collection.id)) duplicateIds += 1;
      ids.add(collection.id);
      orphanMembers += collection.promptIds.filter((id) => !promptIds.has(id)).length;
    }
    return { rawValid: Array.isArray(raw), count: list.length, duplicateIds, orphanMembers, collections: list };
  }

  function analyzeRevisions(storage = root.localStorage, promptIds = new Set()) {
    const raw = readJson(storage, REVISION_KEY, []);
    const revisions = revisionsApi?.readRevisions?.(storage) || [];
    const orphanPromptRefs = revisions.filter((revision) => !promptIds.has(revision.promptId)).length;
    const snapshotMismatches = revisions.filter((revision) => revision.snapshot?.id !== revision.promptId).length;
    return { rawValid: Array.isArray(raw), count: revisions.length, orphanPromptRefs, snapshotMismatches, revisions };
  }

  function analyzeLibrary(storage = root.localStorage) {
    const source = readRawPrompts(storage);
    const raw = source.parsed;
    const rawItems = Array.isArray(raw) ? raw : [];
    const normalized = api?.normalizeCollection?.(rawItems) || [];
    const ids = new Set();
    const duplicateIds = [];
    const invalidIndexes = [];
    let invalidBodies = 0;
    let invalidUseCounts = 0;

    rawItems.forEach((rawItem, index) => {
      if (!rawItem || typeof rawItem !== 'object') {
        invalidIndexes.push(index);
        return;
      }
      const itemId = typeof rawItem.id === 'string' ? rawItem.id : '';
      if (itemId && ids.has(itemId)) duplicateIds.push(itemId);
      if (itemId) ids.add(itemId);
      if (typeof rawItem.body !== 'string' || !rawItem.body) invalidBodies += 1;
      if (!Number.isFinite(rawItem.useCount) || rawItem.useCount < 0) invalidUseCounts += 1;
      if (!api?.normalizeItem?.(rawItem)) invalidIndexes.push(index);
    });

    const promptIds = new Set(normalized.map((item) => item.id));
    const collections = analyzeCollections(storage, promptIds);
    const revisions = analyzeRevisions(storage, promptIds);

    return {
      storageReadable: source.parsed !== null,
      rawIsArray: Array.isArray(raw),
      rawCount: rawItems.length,
      normalizedCount: normalized.length,
      overCapacity: rawItems.length > MAX_ITEMS,
      duplicateIds,
      invalidIndexes: [...new Set(invalidIndexes)],
      invalidBodies,
      invalidUseCounts,
      collections,
      revisions
    };
  }

  function buildSafeRepair(storage = root.localStorage) {
    const report = analyzeLibrary(storage);
    const source = readRawPrompts(storage);
    const rawItems = Array.isArray(source.parsed) ? source.parsed : [];
    const normalized = [];
    const seenIds = new Set();
    const duplicateIds = new Set();
    for (const raw of rawItems.slice(0, MAX_ITEMS * 2)) {
      let item = api?.normalizeItem?.(raw);
      if (!item) continue;
      if (seenIds.has(item.id)) {
        duplicateIds.add(item.id);
        item = Object.freeze({ ...item, id: randomId() });
        while (seenIds.has(item.id)) item = Object.freeze({ ...item, id: randomId() });
      }
      seenIds.add(item.id);
      normalized.push(item);
      if (normalized.length >= MAX_ITEMS) break;
    }
    const promptIds = new Set(normalized.map((item) => item.id));
    const collections = collectionsApi?.pruneMembers?.(collectionsApi?.readCollections?.(storage) || [], storage) || [];
    const revisions = revisionsApi?.readRevisions?.(storage) || [];
    const prunedRevisions = revisions.filter((revision) => promptIds.has(revision.promptId));
    return {
      report,
      normalizedItems: normalized,
      duplicateIds: [...duplicateIds],
      collections,
      revisions: prunedRevisions,
      willRewritePrompts: JSON.stringify(rawItems) !== JSON.stringify(normalized),
      willRewriteCollections: JSON.stringify(collectionsApi?.readCollections?.(storage) || []) !== JSON.stringify(collections),
      willRewriteRevisions: JSON.stringify(revisions) !== JSON.stringify(prunedRevisions)
    };
  }

  function applySafeRepair(storage = root.localStorage, options = {}) {
    const plan = buildSafeRepair(storage);
    if (!plan.report.storageReadable) return { ok: false, reason: 'PROMPT_STORAGE_UNREADABLE' };
    const promptOk = writeJson(storage, PROMPT_KEY, plan.normalizedItems);
    if (!promptOk) return { ok: false, reason: 'PROMPT_STORAGE_FAILED' };

    if (options.collections !== false && collectionsApi?.saveCollections) {
      collectionsApi.saveCollections(storage, plan.collections);
    }
    if (options.revisions !== false && revisionsApi?.saveRevisions) {
      revisionsApi.saveRevisions(storage, plan.revisions);
    }
    try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-safety-changed')); } catch {}
    return {
      ok: true,
      normalized: plan.normalizedItems.length,
      duplicateIdsRekeyed: plan.duplicateIds.length,
      collections: plan.collections.length,
      revisions: plan.revisions.length
    };
  }

  function exportRecoverySnapshot(storage = root.localStorage) {
    const payload = {
      version: 1,
      source: 'hafize-prompt-library-recovery',
      exportedAt: new Date().toISOString(),
      prompts: readRawPrompts(storage).parsed,
      collections: readJson(storage, COLLECTION_KEY, []),
      revisions: readJson(storage, REVISION_KEY, [])
    };
    const output = JSON.stringify(payload, null, 2);
    if (output.length > 1500000) return '';
    return output;
  }

  root.HafizePromptLibrarySafety = Object.freeze({
    PROMPT_KEY,
    COLLECTION_KEY,
    REVISION_KEY,
    MAX_IMPORT_BYTES,
    MAX_ITEMS,
    MAX_PREVIEW,
    readRawPrompts,
    buildImportPlan,
    applyImportPlan,
    analyzeLibrary,
    buildSafeRepair,
    applySafeRepair,
    exportRecoverySnapshot
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
