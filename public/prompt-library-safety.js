(function installPromptLibrarySafety(root) {
  'use strict';

  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const QUARANTINE_KEY = 'hafize.prompt-library.quarantine.v1';
  const REPAIR_BACKUP_KEY = 'hafize.prompt-library.repair-backup.v1';
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
        invalid.push({
          index: source.indexOf(raw),
          reason: !raw || typeof raw !== 'object' ? 'nesne değil' : (!raw.body ? 'body boş' : 'model sınırlarına uymuyor')
        });
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

  function normalizeRecoveryPayload(payload) {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.prompts)) {
      return null;
    }
    return {
      version: 1,
      source: 'hafize-prompt-library-recovery',
      exportedAt: clip(payload.exportedAt, 40),
      items: payload.prompts
    };
  }

  function buildRepairPreview(storage = root.localStorage) {
    const plan = buildSafeRepair(storage);
    return {
      rawCount: plan.report.rawCount,
      normalizedCount: plan.normalizedItems.length,
      invalidCount: plan.report.invalidIndexes.length,
      duplicateCount: plan.duplicateIds.length,
      collectionCount: plan.report.collections.count,
      orphanCollectionMembers: plan.report.collections.orphanMembers,
      revisionCount: plan.report.revisions.count,
      orphanRevisionRefs: plan.report.revisions.orphanPromptRefs,
      rewrites: {
        prompts: plan.willRewritePrompts,
        collections: plan.willRewriteCollections,
        revisions: plan.willRewriteRevisions
      }
    };
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
      invalidSamples: invalid.slice(0, 6),
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

  function createRepairCheckpoint(storage = root.localStorage) {
    const payload = exportRecoverySnapshot(storage);
    if (!payload) return false;
    return writeJson(storage, REPAIR_BACKUP_KEY, { version: 1, createdAt: new Date().toISOString(), payload });
  }

  function hasRepairCheckpoint(storage = root.localStorage) {
    const value = readJson(storage, REPAIR_BACKUP_KEY, null);
    return Boolean(value && typeof value.payload === 'string' && value.payload);
  }

  function undoLastRepair(storage = root.localStorage) {
    const checkpoint = readJson(storage, REPAIR_BACKUP_KEY, null);
    if (!checkpoint || typeof checkpoint.payload !== 'string') return { ok: false, reason: 'NO_REPAIR_CHECKPOINT' };
    let payload;
    try { payload = JSON.parse(checkpoint.payload); } catch { return { ok: false, reason: 'CHECKPOINT_CORRUPT' }; }
    if (!payload || !Array.isArray(payload.prompts)) return { ok: false, reason: 'CHECKPOINT_INVALID' };
    if (!writeJson(storage, PROMPT_KEY, payload.prompts)) return { ok: false, reason: 'PROMPT_RESTORE_FAILED' };
    if (Array.isArray(payload.collections)) writeJson(storage, COLLECTION_KEY, payload.collections);
    if (Array.isArray(payload.revisions)) writeJson(storage, REVISION_KEY, payload.revisions);
    writeJson(storage, REPAIR_BACKUP_KEY, null);
    try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-safety-changed')); } catch {}
    return { ok: true, restored: payload.prompts.length };
  }

  function applySafeRepair(storage = root.localStorage, options = {}) {
    const plan = buildSafeRepair(storage);
    if (!plan.report.storageReadable) return { ok: false, reason: 'PROMPT_STORAGE_UNREADABLE' };
    if (!createRepairCheckpoint(storage)) return { ok: false, reason: 'REPAIR_CHECKPOINT_FAILED' };
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

  function readQuarantine(storage = root.localStorage) {
    const value = readJson(storage, QUARANTINE_KEY, { version: 1, createdAt: '', items: [] });
    return value && typeof value === 'object' && Array.isArray(value.items) ? value : { version: 1, createdAt: '', items: [] };
  }

  function quarantineInvalidItems(storage = root.localStorage, indexes = []) {
    const raw = readRawPrompts(storage);
    if (!Array.isArray(raw.parsed)) return { ok: false, reason: 'PROMPT_STORAGE_INVALID', count: 0 };
    const indexSet = new Set(indexes.filter((value) => Number.isInteger(value) && value >= 0));
    if (!indexSet.size) return { ok: false, reason: 'NO_INVALID_ITEMS', count: 0 };
    const removed = raw.parsed.filter(function (_item, index) { return indexSet.has(index); });
    const kept = raw.parsed.filter(function (_item, index) { return !indexSet.has(index); });
    const existing = readQuarantine(storage);
    const mergedQuarantine = {
      version: 1,
      createdAt: existing.createdAt || new Date().toISOString(),
      items: existing.items.concat(removed).slice(-80)
    };
    const output = JSON.stringify(mergedQuarantine);
    if (output.length > 1000000) return { ok: false, reason: 'QUARANTINE_TOO_LARGE', count: 0 };
    if (!writeJson(storage, QUARANTINE_KEY, mergedQuarantine)) return { ok: false, reason: 'QUARANTINE_WRITE_FAILED', count: 0 };
    if (!writeJson(storage, PROMPT_KEY, kept)) return { ok: false, reason: 'PROMPT_WRITE_FAILED', count: 0 };
    try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-safety-changed')); } catch {}
    return { ok: true, reason: '', count: removed.length };
  }

  function restoreQuarantine(storage = root.localStorage) {
    const quarantine = readQuarantine(storage);
    if (!quarantine.items.length) return { ok: false, reason: 'QUARANTINE_EMPTY', imported: 0 };
    const merged = api?.mergeImportedItems?.(freshCurrent(storage), quarantine.items);
    if (!merged || api?.saveItems?.(storage, merged.items) !== true) {
      return { ok: false, reason: 'RESTORE_FAILED', imported: 0 };
    }
    if (!writeJson(storage, QUARANTINE_KEY, { version: 1, createdAt: new Date().toISOString(), items: [] })) {
      return { ok: false, reason: 'QUARANTINE_CLEAR_FAILED', imported: 0 };
    }
    try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-safety-changed')); } catch {}
    return { ok: true, reason: '', imported: merged.imported };
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
    QUARANTINE_KEY,
    REPAIR_BACKUP_KEY,
    MAX_IMPORT_BYTES,
    MAX_ITEMS,
    MAX_PREVIEW,
    readRawPrompts,
    buildImportPlan,
    normalizeRecoveryPayload,
    buildRepairPreview,
    applyImportPlan,
    analyzeLibrary,
    buildSafeRepair,
    applySafeRepair,
    exportRecoverySnapshot,
    readQuarantine,
    quarantineInvalidItems,
    restoreQuarantine,
    createRepairCheckpoint,
    hasRepairCheckpoint,
    undoLastRepair
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
