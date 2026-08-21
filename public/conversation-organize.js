(function exposeHafizeConversationOrganize(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeConversationOrganize = api;
  const install = () => api.install(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationOrganize() {
  'use strict';

  const SOURCE_KEY = 'hafize.conversations.v1';
  const STORAGE_KEY = 'hafize.conversation-organize.v1';
  const MAX_ENTRIES = 30;
  const MAX_SESSION_MUTATIONS = 30;
  const MAX_ID_CHARS = 160;
  const MAX_TITLE_CHARS = 80;
  const ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const ACTIVE_LISTS = new WeakSet();

  function normalizeConversationId(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > MAX_ID_CHARS || !ID_PATTERN.test(clean)) return null;
    return clean;
  }

  function normalizeTitle(value) {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean || clean.length > MAX_TITLE_CHARS) return null;
    return clean;
  }

  function normalizeEntry(value) {
    if (!value || typeof value !== 'object') return null;
    const id = normalizeConversationId(value.id);
    if (!id) return null;
    const title = value.title === undefined || value.title === null || value.title === ''
      ? null
      : normalizeTitle(value.title);
    if (value.title && !title) return null;
    return Object.freeze({ id, title, pinned: value.pinned === true });
  }

  function normalizeEntries(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const result = [];
    for (const candidate of value) {
      const entry = normalizeEntry(candidate);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      result.push(entry);
      if (result.length >= MAX_ENTRIES) break;
    }
    return result;
  }

  function parseEntries(raw) {
    if (typeof raw !== 'string' || !raw) return [];
    try {
      return normalizeEntries(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function serializeEntries(entries) {
    return JSON.stringify(normalizeEntries(entries));
  }

  function readSourceConversations(storage) {
    let parsed;
    try {
      parsed = JSON.parse(storage?.getItem?.(SOURCE_KEY) || '[]');
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const result = [];
    for (const item of parsed.slice(0, MAX_ENTRIES)) {
      const id = normalizeConversationId(item?.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push(Object.freeze({
        id,
        title: normalizeTitle(item?.title) || 'Yeni sohbet'
      }));
    }
    return result;
  }

  function mergeEntry(entries, id, patch) {
    const cleanId = normalizeConversationId(id);
    if (!cleanId || !patch || typeof patch !== 'object') return normalizeEntries(entries);
    const source = normalizeEntries(entries);
    const previous = source.find((entry) => entry.id === cleanId) || { id: cleanId, title: null, pinned: false };
    let title = previous.title;
    if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
      if (patch.title === null || patch.title === '') title = null;
      else {
        title = normalizeTitle(patch.title);
        if (!title) return source;
      }
    }
    const pinned = Object.prototype.hasOwnProperty.call(patch, 'pinned') ? patch.pinned === true : previous.pinned;
    const next = { id: cleanId, title, pinned };
    const without = source.filter((entry) => entry.id !== cleanId);
    if (!next.title && !next.pinned) return without;
    return [next, ...without].slice(0, MAX_ENTRIES);
  }

  function entryFor(entries, id) {
    const cleanId = normalizeConversationId(id);
    if (!cleanId) return null;
    return normalizeEntries(entries).find((entry) => entry.id === cleanId) || null;
  }

  function sameEntry(left, right) {
    const a = left == null ? null : normalizeEntry(left);
    const b = right == null ? null : normalizeEntry(right);
    if (a === null || b === null) return a === b;
    return a.id === b.id && a.title === b.title && a.pinned === b.pinned;
  }

  function replaceEntry(entries, id, value) {
    const cleanId = normalizeConversationId(id);
    if (!cleanId) return normalizeEntries(entries);
    const source = normalizeEntries(entries).filter((entry) => entry.id !== cleanId);
    if (value == null) return source;
    const entry = normalizeEntry(value);
    if (!entry || entry.id !== cleanId) return source;
    return normalizeEntries([entry, ...source]);
  }

  function normalizeMutation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = normalizeConversationId(value.id);
    if (!id) return null;
    const before = value.before == null ? null : normalizeEntry(value.before);
    const after = value.after == null ? null : normalizeEntry(value.after);
    if ((value.before != null && !before) || (value.after != null && !after)) return null;
    if ((before && before.id !== id) || (after && after.id !== id) || sameEntry(before, after)) return null;
    return Object.freeze({ id, before, after });
  }

  function reconcileMutation(entries, mutation) {
    const source = normalizeEntries(entries);
    const normalized = normalizeMutation(mutation);
    if (!normalized) return Object.freeze({ entries: source, status: 'invalid' });
    const current = entryFor(source, normalized.id);
    if (sameEntry(current, normalized.after)) return Object.freeze({ entries: source, status: 'settled' });
    if (sameEntry(current, normalized.before)) {
      return Object.freeze({ entries: replaceEntry(source, normalized.id, normalized.after), status: 'replay' });
    }
    return Object.freeze({ entries: source, status: 'conflict' });
  }

  function pruneEntries(entries, sourceIds) {
    const allowed = new Set((Array.isArray(sourceIds) ? sourceIds : []).map(normalizeConversationId).filter(Boolean));
    return normalizeEntries(entries).filter((entry) => allowed.has(entry.id));
  }

  function sortIds(sourceIds, entries) {
    const source = (Array.isArray(sourceIds) ? sourceIds : []).map(normalizeConversationId).filter(Boolean);
    const metadata = new Map(normalizeEntries(entries).map((entry) => [entry.id, entry]));
    return source
      .map((id, index) => ({ id, index, pinned: metadata.get(id)?.pinned === true }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.index - b.index)
      .map((item) => item.id);
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-conversation-organize-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/conversation-organize.css';
    link.setAttribute('data-hafize-conversation-organize-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function install(documentRef, root) {
    if (!documentRef || !root) return null;
    const list = documentRef.querySelector?.('#conversationList');
    if (!list || ACTIVE_LISTS.has(list)) return null;

    ACTIVE_LISTS.add(list);
    const storage = root.localStorage;
    let entries = parseEntries(storage?.getItem?.(STORAGE_KEY));
    let mounted = false;
    let destroyed = false;
    let rendering = false;
    let pendingFrame = null;
    let pendingKind = null;
    let observer = null;
    let styleOwned = false;
    let storageListening = false;
    const sessionMutations = new Map();
    const rowSnapshots = new Map();
    const ownedActions = new Map();
    const ownedEditors = new Set();
    const listenerCleanup = [];

    function isLive() {
      return !destroyed && mounted && ACTIVE_LISTS.has(list);
    }

    function rememberAttribute(node, name) {
      return Object.freeze({ present: node?.hasAttribute?.(name) === true, value: node?.getAttribute?.(name) });
    }

    function restoreAttribute(node, name, snapshot) {
      if (!node || !snapshot) return;
      if (snapshot.present) node.setAttribute?.(name, snapshot.value ?? '');
      else node.removeAttribute?.(name);
    }

    function snapshotRow(row) {
      if (!row || rowSnapshots.has(row)) return;
      const open = row.querySelector?.('.conversation-open');
      const remove = row.querySelector?.('.conversation-delete');
      rowSnapshots.set(row, Object.freeze({
        dataset: Object.freeze({
          present: Object.prototype.hasOwnProperty.call(row.dataset || {}, 'conversationOrganizeId'),
          value: row.dataset?.conversationOrganizeId
        }),
        pinned: row.classList?.contains?.('conversation-pinned') === true,
        editing: row.classList?.contains?.('organize-editing') === true,
        openText: open?.textContent,
        openTitle: rememberAttribute(open, 'title'),
        removeLabel: rememberAttribute(remove, 'aria-label')
      }));
    }

    function restoreRow(row, snapshot) {
      if (!row || !snapshot) return;
      closeEditor(row);
      ownedActions.get(row)?.remove?.();
      ownedActions.delete(row);
      const open = row.querySelector?.('.conversation-open');
      const remove = row.querySelector?.('.conversation-delete');
      if (open && snapshot.openText !== undefined) open.textContent = snapshot.openText;
      restoreAttribute(open, 'title', snapshot.openTitle);
      restoreAttribute(remove, 'aria-label', snapshot.removeLabel);
      row.classList?.toggle?.('conversation-pinned', snapshot.pinned);
      row.classList?.toggle?.('organize-editing', snapshot.editing);
      if (snapshot.dataset.present) row.dataset.conversationOrganizeId = snapshot.dataset.value;
      else if (row.dataset) delete row.dataset.conversationOrganizeId;
    }

    function addListener(target, type, listener) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_CONVERSATION_ORGANIZE_LISTENER_TARGET');
      }
      target.addEventListener(type, listener);
      listenerCleanup.push(() => target.removeEventListener(type, listener));
    }

    function persist(next) {
      if (!isLive()) return false;
      const normalized = normalizeEntries(next);
      try {
        storage?.setItem?.(STORAGE_KEY, serializeEntries(normalized));
        entries = normalized;
        return true;
      } catch {
        return false;
      }
    }

    function sourceSnapshot() {
      return isLive() ? readSourceConversations(storage) : [];
    }

    function metadataFor(id) {
      return entries.find((entry) => entry.id === id) || null;
    }

    function rememberMutation(id, before, after) {
      if (!isLive()) return false;
      const mutation = normalizeMutation({ id, before, after });
      if (!mutation) {
        sessionMutations.delete(id);
        return false;
      }
      sessionMutations.set(mutation.id, mutation);
      while (sessionMutations.size > MAX_SESSION_MUTATIONS) sessionMutations.delete(sessionMutations.keys().next().value);
      return true;
    }

    function persistMutation(id, patch) {
      if (!isLive()) return false;
      const cleanId = normalizeConversationId(id);
      if (!cleanId) return false;
      const before = metadataFor(cleanId);
      const next = mergeEntry(entries, cleanId, patch);
      const after = entryFor(next, cleanId);
      if (sameEntry(before, after)) return true;
      if (!persist(next)) return false;
      rememberMutation(cleanId, before, after);
      return true;
    }

    function closeEditor(row) {
      const editor = row?.querySelector?.('.conversation-organize-editor');
      if (editor && ownedEditors.has(editor)) {
        ownedEditors.delete(editor);
        editor.remove?.();
      }
      if (rowSnapshots.has(row)) row?.classList?.remove?.('organize-editing');
    }

    function createEditor(row, rename) {
      if (!isLive()) return false;
      closeEditor(row);
      const currentId = normalizeConversationId(row.dataset?.conversationOrganizeId);
      if (!currentId) return false;
      const currentSource = sourceSnapshot().find((item) => item.id === currentId);
      if (!currentSource) return false;

      const editor = documentRef.createElement('form');
      editor.className = 'conversation-organize-editor';
      const input = documentRef.createElement('input');
      input.type = 'text';
      input.maxLength = MAX_TITLE_CHARS;
      input.value = metadataFor(currentId)?.title || currentSource.title;
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Yeni sohbet başlığı');
      const save = documentRef.createElement('button');
      save.type = 'submit';
      save.textContent = 'Kaydet';
      const reset = documentRef.createElement('button');
      reset.type = 'button';
      reset.textContent = 'Otomatik';
      const cancel = documentRef.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Vazgeç';
      editor.append(input, save, reset, cancel);
      row.append(editor);
      ownedEditors.add(editor);
      row.classList?.add?.('organize-editing');

      const onSubmit = (event) => {
        event.preventDefault?.();
        if (!isLive() || !ownedEditors.has(editor)) return;
        const nextTitle = normalizeTitle(input.value);
        if (!nextTitle) {
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        if (persistMutation(currentId, { title: nextTitle })) {
          closeEditor(row);
          renderNow();
        }
      };
      const onReset = () => {
        if (!isLive() || !ownedEditors.has(editor)) return;
        if (persistMutation(currentId, { title: null })) {
          closeEditor(row);
          renderNow();
        }
      };
      const onCancel = () => { if (isLive()) closeEditor(row); };
      const onKeydown = (event) => {
        if (!isLive() || event?.key !== 'Escape') return;
        event.preventDefault?.();
        closeEditor(row);
        rename.focus?.();
      };
      addListener(editor, 'submit', onSubmit);
      addListener(reset, 'click', onReset);
      addListener(cancel, 'click', onCancel);
      addListener(input, 'keydown', onKeydown);
      input.focus?.();
      input.select?.();
      return true;
    }

    function createActions(row) {
      if (!isLive() || row.querySelector?.('.conversation-organize-actions')) return null;
      const actions = documentRef.createElement('div');
      actions.className = 'conversation-organize-actions';
      const pin = documentRef.createElement('button');
      pin.type = 'button';
      pin.className = 'conversation-pin';
      const rename = documentRef.createElement('button');
      rename.type = 'button';
      rename.className = 'conversation-rename';
      rename.textContent = '✎';
      rename.title = 'Başlığı düzenle';
      rename.setAttribute('aria-label', 'Sohbet başlığını düzenle');
      actions.append(pin, rename);
      const remove = row.querySelector?.('.conversation-delete');
      row.insertBefore?.(actions, remove || null);
      ownedActions.set(row, actions);

      addListener(pin, 'click', (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (!isLive() || ownedActions.get(row) !== actions) return;
        const currentId = normalizeConversationId(row.dataset?.conversationOrganizeId);
        if (!currentId) return;
        const current = metadataFor(currentId);
        if (persistMutation(currentId, { pinned: current?.pinned !== true })) renderNow();
      });
      addListener(rename, 'click', (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (!isLive() || ownedActions.get(row) !== actions) return;
        createEditor(row, rename);
      });
      return actions;
    }

    function applyRow(row, source) {
      if (!isLive() || !row || !source) return;
      snapshotRow(row);
      const id = source.id;
      row.dataset.conversationOrganizeId = id;
      const open = row.querySelector?.('.conversation-open');
      const remove = row.querySelector?.('.conversation-delete');
      if (!open) return;

      const meta = metadataFor(id);
      const title = meta?.title || source.title;
      open.textContent = title;
      open.setAttribute?.('title', title);
      remove?.setAttribute?.('aria-label', `${title} sohbetini sil`);
      row.classList?.toggle?.('conversation-pinned', meta?.pinned === true);

      let actions = ownedActions.get(row) || null;
      if (!actions && !row.querySelector?.('.conversation-organize-actions')) actions = createActions(row);
      const pin = actions?.querySelector?.('.conversation-pin');
      const pinned = meta?.pinned === true;
      if (pin) {
        pin.textContent = pinned ? '★' : '☆';
        pin.setAttribute('aria-pressed', String(pinned));
        pin.setAttribute('aria-label', pinned ? `${title} sohbetinin sabitlemesini kaldır` : `${title} sohbetini sabitle`);
        pin.title = pinned ? 'Sabitlemeyi kaldır' : 'Sohbeti sabitle';
      }
    }

    function renderNow() {
      if (!isLive() || rendering) return false;
      rendering = true;
      try {
        const source = sourceSnapshot();
        const sourceIds = source.map((item) => item.id);
        const allowed = new Set(sourceIds);
        for (const id of sessionMutations.keys()) if (!allowed.has(id)) sessionMutations.delete(id);
        const pruned = pruneEntries(entries, sourceIds);
        if (serializeEntries(pruned) !== serializeEntries(entries) && !persist(pruned)) return false;

        const rows = Array.from(list.querySelectorAll?.('.conversation-row') || []);
        for (const row of rows) snapshotRow(row);
        const untagged = rows.filter((row) => !normalizeConversationId(row.dataset?.conversationOrganizeId));
        if (untagged.length) {
          for (let index = 0; index < rows.length && index < source.length; index += 1) {
            if (!normalizeConversationId(rows[index].dataset?.conversationOrganizeId)) rows[index].dataset.conversationOrganizeId = source[index].id;
          }
        }

        const sourceById = new Map(source.map((item) => [item.id, item]));
        for (const row of rows) {
          const id = normalizeConversationId(row.dataset?.conversationOrganizeId);
          if (id && sourceById.has(id)) applyRow(row, sourceById.get(id));
        }

        const order = sortIds(sourceIds, entries);
        const rowById = new Map(rows.map((row) => [normalizeConversationId(row.dataset?.conversationOrganizeId), row]));
        const fragment = documentRef.createDocumentFragment?.();
        if (fragment) {
          for (const id of order) {
            const row = rowById.get(id);
            if (row) fragment.append(row);
          }
          if (isLive()) list.append(fragment);
        }
        return true;
      } finally {
        rendering = false;
      }
    }

    function cancelPending() {
      if (pendingFrame === null) return;
      if (pendingKind === 'raf') root.cancelAnimationFrame?.(pendingFrame);
      else root.clearTimeout?.(pendingFrame);
      pendingFrame = null;
      pendingKind = null;
    }

    function scheduleRender() {
      if (!isLive() || rendering || pendingFrame !== null) return false;
      const run = () => {
        pendingFrame = null;
        pendingKind = null;
        if (isLive()) renderNow();
      };
      if (typeof root.requestAnimationFrame === 'function' && typeof root.cancelAnimationFrame === 'function') {
        pendingKind = 'raf';
        pendingFrame = root.requestAnimationFrame(run);
        return true;
      }
      if (typeof root.setTimeout === 'function' && typeof root.clearTimeout === 'function') {
        pendingKind = 'timer';
        pendingFrame = root.setTimeout(run, 0);
        return true;
      }
      return renderNow();
    }

    function onStorage(event) {
      if (!isLive() || (event?.key !== STORAGE_KEY && event?.key !== SOURCE_KEY)) return;
      if (event.key === STORAGE_KEY) {
        const remote = parseEntries(event.newValue || '');
        entries = remote;
        let replayed = false;
        for (const [id, mutation] of sessionMutations) {
          const result = reconcileMutation(entries, mutation);
          entries = result.entries;
          if (result.status === 'replay') replayed = true;
          else sessionMutations.delete(id);
        }
        const sourceIds = sourceSnapshot().map((item) => item.id);
        const allowed = new Set(sourceIds);
        for (const id of sessionMutations.keys()) if (!allowed.has(id)) sessionMutations.delete(id);
        entries = pruneEntries(entries, sourceIds);
        if (replayed && serializeEntries(entries) !== serializeEntries(remote)) persist(entries);
      }
      scheduleRender();
    }

    function rollback() {
      cancelPending();
      observer?.disconnect?.();
      observer = null;
      if (storageListening) {
        try { root.removeEventListener?.('storage', onStorage); } catch {}
        storageListening = false;
      }
      while (listenerCleanup.length) {
        try { listenerCleanup.pop()?.(); } catch {}
      }
      for (const editor of ownedEditors) editor.remove?.();
      ownedEditors.clear();
      for (const [row, snapshot] of rowSnapshots) restoreRow(row, snapshot);
      rowSnapshots.clear();
      ownedActions.clear();
      sessionMutations.clear();
      if (styleOwned) {
        documentRef.querySelector?.('link[data-hafize-conversation-organize-style]')?.remove?.();
        styleOwned = false;
      }
      ACTIVE_LISTS.delete(list);
      mounted = false;
    }

    try {
      styleOwned = ensureStyles(documentRef);
      mounted = true;
      if (typeof root.MutationObserver === 'function') {
        observer = new root.MutationObserver(() => { if (isLive()) scheduleRender(); });
        observer.observe(list, { childList: true, subtree: true });
      }
      if (typeof root.addEventListener === 'function') {
        root.addEventListener('storage', onStorage);
        storageListening = true;
      }
      if (!renderNow()) throw new Error('CONVERSATION_ORGANIZE_INITIAL_RENDER_FAILED');
    } catch {
      rollback();
      destroyed = true;
      return null;
    }

    return Object.freeze({
      getEntries: () => Object.freeze(entries.map((entry) => Object.freeze({ ...entry }))),
      getPendingMutationCount: () => sessionMutations.size,
      getState: () => Object.freeze({ mounted: isLive(), destroyed, pending: pendingFrame !== null }),
      refresh: () => isLive() ? renderNow() : false,
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        rollback();
        return true;
      }
    });
  }

  return Object.freeze({
    SOURCE_KEY,
    STORAGE_KEY,
    MAX_ENTRIES,
    MAX_SESSION_MUTATIONS,
    MAX_ID_CHARS,
    MAX_TITLE_CHARS,
    normalizeConversationId,
    normalizeTitle,
    normalizeEntry,
    normalizeEntries,
    parseEntries,
    serializeEntries,
    readSourceConversations,
    mergeEntry,
    entryFor,
    sameEntry,
    replaceEntry,
    normalizeMutation,
    reconcileMutation,
    pruneEntries,
    sortIds,
    install
  });
});