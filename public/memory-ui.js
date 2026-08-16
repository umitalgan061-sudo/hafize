(function exposeHafizeMemoryUi(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeMemoryUi = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMemoryUi() {
  'use strict';

  const MEMORY_PATH = '/api/memory';
  const MEMORY_EXPORT_PATH = '/api/memory/export';
  const SESSION_STATUS_PATH = '/api/session/status';
  const MEMORY_ID = /^memory_[A-Za-z0-9_-]{8,80}$/;
  const MEMORY_KINDS = Object.freeze(['identity', 'preference', 'project', 'note']);
  const MAX_EXPORT_BYTES = 4 * 1024 * 1024;
  const KIND_LABELS = Object.freeze({
    identity: 'Kimlik',
    preference: 'Tercih',
    project: 'Proje',
    note: 'Not'
  });

  async function readPayload(response) {
    try {
      const payload = await response.json();
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    } catch {
      return {};
    }
  }

  function createMemoryClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_MEMORY_CLIENT_FETCH');

    async function request(path, init = {}) {
      const response = await fetchImpl(path, {
        ...init,
        headers: { Accept: 'application/json', ...(init.headers || {}) },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      return Object.freeze({
        ok: Boolean(response?.ok),
        status: Number(response?.status) || 0,
        payload: Object.freeze(await readPayload(response))
      });
    }

    return Object.freeze({
      sessionStatus() {
        return request(SESSION_STATUS_PATH, { method: 'GET' });
      },
      search(query, { kind, limit = 10 } = {}) {
        const cleanQuery = typeof query === 'string' ? query.trim() : '';
        if (!cleanQuery || cleanQuery.length > 1000) throw new Error('INVALID_MEMORY_QUERY');
        const url = new URL(MEMORY_PATH, 'https://hafize.invalid');
        url.searchParams.set('query', cleanQuery);
        if (kind) {
          if (!MEMORY_KINDS.includes(kind)) throw new Error('INVALID_MEMORY_KIND');
          url.searchParams.set('kinds', kind);
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('INVALID_MEMORY_LIMIT');
        url.searchParams.set('limit', String(limit));
        return request(`${url.pathname}${url.search}`, { method: 'GET' });
      },
      write({ kind, content }) {
        if (!MEMORY_KINDS.includes(kind)) throw new Error('INVALID_MEMORY_KIND');
        const cleanContent = typeof content === 'string' ? content.trim() : '';
        if (!cleanContent || cleanContent.length > 4000) throw new Error('INVALID_MEMORY_CONTENT');
        return request(MEMORY_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            content: cleanContent,
            sourceType: 'user_note',
            sensitivity: 'personal',
            explicitUserIntent: true
          })
        });
      },
      remove(memoryId) {
        if (typeof memoryId !== 'string' || !MEMORY_ID.test(memoryId)) throw new Error('INVALID_MEMORY_ID');
        return request(`${MEMORY_PATH}/${encodeURIComponent(memoryId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exactMatch: true, explicitUserIntent: true })
        });
      },
      exportAll() {
        return request(MEMORY_EXPORT_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ explicitUserIntent: true })
        });
      },
      removeAll() {
        return request(MEMORY_PATH, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ explicitUserIntent: true, confirmDeleteAll: true })
        });
      }
    });
  }

  function normalizeExportRecords(value) {
    if (!Array.isArray(value)) throw new Error('INVALID_MEMORY_EXPORT');
    const records = [];
    for (const record of value) {
      if (!record || Array.isArray(record) || typeof record !== 'object') throw new Error('INVALID_MEMORY_EXPORT');
      const memoryId = typeof record.memoryId === 'string' && MEMORY_ID.test(record.memoryId) ? record.memoryId : '';
      const kind = typeof record.kind === 'string' && MEMORY_KINDS.includes(record.kind) ? record.kind : '';
      const content = typeof record.content === 'string' ? record.content : '';
      if (!memoryId || !kind || !content.trim()) throw new Error('INVALID_MEMORY_EXPORT');
      if ('ownerId' in record) throw new Error('INVALID_MEMORY_EXPORT_OWNER');
      records.push({ ...record });
    }
    return records;
  }

  function createExportText(records, { now = () => new Date() } = {}) {
    const safeRecords = normalizeExportRecords(records);
    const createdAt = now();
    const exportedAt = createdAt instanceof Date && Number.isFinite(createdAt.getTime())
      ? createdAt.toISOString()
      : new Date(0).toISOString();
    const text = `${JSON.stringify({ schemaVersion: 1, exportedAt, records: safeRecords }, null, 2)}\n`;
    if (new TextEncoder().encode(text).byteLength > MAX_EXPORT_BYTES) throw new Error('MEMORY_EXPORT_TOO_LARGE');
    return Object.freeze({
      text,
      filename: `hafize-memory-${exportedAt.slice(0, 10)}.json`,
      count: safeRecords.length
    });
  }

  function messageFor(response) {
    const code = response?.payload?.error;
    if (response?.status === 401 || code === 'AUTH_REQUIRED') return 'Bellek için önce güvenli oturum aç.';
    if (response?.status === 403 || code === 'ORIGIN_REQUIRED') return 'Bu işlem yalnız güvenli Hafize adresinden yapılabilir.';
    if (response?.status === 404) return 'Kişisel bellek sunucuda henüz yapılandırılmamış.';
    if (code === 'MEMORY_OPERATION_FAILED') return 'Bellek işlemi doğrulanamadı.';
    return 'Bellek işlemi tamamlanamadı.';
  }

  function mount({
    documentRef = globalThis.document,
    fetchImpl = globalThis.fetch,
    confirmImpl = globalThis.confirm,
    BlobImpl = globalThis.Blob,
    urlApi = globalThis.URL,
    now = () => new Date()
  } = {}) {
    if (!documentRef) return false;
    const nodes = {
      card: documentRef.querySelector('#memoryCard'),
      status: documentRef.querySelector('#memoryStatus'),
      searchForm: documentRef.querySelector('#memorySearchForm'),
      query: documentRef.querySelector('#memoryQuery'),
      kindFilter: documentRef.querySelector('#memoryKindFilter'),
      searchButton: documentRef.querySelector('#memorySearchBtn'),
      results: documentRef.querySelector('#memoryResults'),
      writeForm: documentRef.querySelector('#memoryWriteForm'),
      writeKind: documentRef.querySelector('#memoryWriteKind'),
      content: documentRef.querySelector('#memoryContent'),
      writeButton: documentRef.querySelector('#memoryWriteBtn'),
      exportButton: documentRef.querySelector('#memoryExportBtn'),
      deleteAllButton: documentRef.querySelector('#memoryDeleteAllBtn')
    };
    if (Object.values(nodes).some((node) => !node)) return false;

    const client = createMemoryClient({ fetchImpl });
    let authenticated = false;
    let busy = false;

    function setStatus(text, state = 'idle') {
      nodes.status.textContent = text;
      nodes.status.dataset.state = state;
    }

    function updateControls() {
      const disabled = busy || !authenticated;
      nodes.query.disabled = disabled;
      nodes.kindFilter.disabled = disabled;
      nodes.searchButton.disabled = disabled;
      nodes.writeKind.disabled = disabled;
      nodes.content.disabled = disabled;
      nodes.writeButton.disabled = disabled;
      nodes.exportButton.disabled = disabled;
      nodes.deleteAllButton.disabled = disabled;
      nodes.card.setAttribute('aria-busy', String(busy));
    }

    function clearResults() {
      nodes.results.replaceChildren();
      nodes.results.hidden = true;
    }

    function renderRecords(records) {
      clearResults();
      if (!Array.isArray(records) || records.length === 0) {
        setStatus('Eşleşen kişisel bellek bulunamadı.', 'idle');
        return;
      }
      const fragment = documentRef.createDocumentFragment();
      for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        const memoryId = typeof record.memoryId === 'string' && MEMORY_ID.test(record.memoryId) ? record.memoryId : '';
        const content = typeof record.content === 'string' ? record.content.trim() : '';
        if (!memoryId || !content) continue;

        const item = documentRef.createElement('article');
        item.className = 'memory-result';
        const meta = documentRef.createElement('div');
        meta.className = 'memory-result-meta';
        const kind = documentRef.createElement('span');
        kind.textContent = KIND_LABELS[record.kind] || 'Bellek';
        const remove = documentRef.createElement('button');
        remove.type = 'button';
        remove.className = 'memory-delete-btn';
        remove.textContent = 'Sil';
        remove.dataset.memoryId = memoryId;
        remove.setAttribute('aria-label', 'Bu bellek kaydını sil');
        meta.append(kind, remove);
        const body = documentRef.createElement('p');
        body.textContent = content;
        item.append(meta, body);
        fragment.append(item);
      }
      if (!fragment.childNodes.length) {
        setStatus('Görüntülenebilir bellek kaydı bulunamadı.', 'idle');
        return;
      }
      nodes.results.append(fragment);
      nodes.results.hidden = false;
      setStatus('Bellek sonuçları yalnız bu oturum için gösteriliyor.', 'active');
    }

    async function refreshSession() {
      try {
        const response = await client.sessionStatus();
        authenticated = response.ok && response.payload?.authenticated === true;
        if (!authenticated) {
          clearResults();
          setStatus(messageFor(response), response.status === 404 ? 'disabled' : 'idle');
        } else {
          setStatus('Kişisel belleğini ara, dışa aktar veya açıkça yeni bir not kaydet.', 'active');
        }
      } catch {
        authenticated = false;
        clearResults();
        setStatus('Bellek oturum durumu alınamadı.', 'error');
      }
      updateControls();
      return authenticated;
    }

    nodes.searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy || !authenticated) return;
      const query = nodes.query.value.trim();
      if (!query) {
        setStatus('Aramak istediğin bilgiyi yaz.', 'error');
        nodes.query.focus();
        return;
      }
      busy = true;
      updateControls();
      setStatus('Kişisel bellek aranıyor…', 'loading');
      try {
        const response = await client.search(query, { kind: nodes.kindFilter.value || undefined });
        if (!response.ok) {
          clearResults();
          setStatus(messageFor(response), 'error');
          if (response.status === 401) await refreshSession();
          return;
        }
        renderRecords(response.payload?.records);
      } catch {
        clearResults();
        setStatus('Bellek araması tamamlanamadı.', 'error');
      } finally {
        busy = false;
        updateControls();
      }
    });

    nodes.writeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy || !authenticated) return;
      const content = nodes.content.value.trim();
      if (!content) {
        setStatus('Kaydetmek istediğin bilgiyi yaz.', 'error');
        nodes.content.focus();
        return;
      }
      busy = true;
      updateControls();
      setStatus('Açık isteğinle kişisel belleğe kaydediliyor…', 'loading');
      try {
        const response = await client.write({ kind: nodes.writeKind.value, content });
        if (!response.ok) {
          setStatus(messageFor(response), 'error');
          if (response.status === 401) await refreshSession();
          return;
        }
        nodes.content.value = '';
        setStatus('Kişisel bellek kaydı oluşturuldu.', 'active');
      } catch {
        setStatus('Bellek kaydı oluşturulamadı.', 'error');
      } finally {
        busy = false;
        updateControls();
      }
    });

    nodes.results.addEventListener('click', async (event) => {
      const button = event.target?.closest?.('.memory-delete-btn');
      if (!button || busy || !authenticated) return;
      const memoryId = button.dataset.memoryId;
      if (!MEMORY_ID.test(memoryId || '')) return;
      busy = true;
      updateControls();
      button.disabled = true;
      setStatus('Seçili bellek kaydı siliniyor…', 'loading');
      try {
        const response = await client.remove(memoryId);
        if (!response.ok) {
          setStatus(messageFor(response), 'error');
          if (response.status === 401) await refreshSession();
          return;
        }
        button.closest('.memory-result')?.remove();
        if (!nodes.results.children.length) nodes.results.hidden = true;
        setStatus('Seçili bellek kaydı silindi.', 'active');
      } catch {
        setStatus('Bellek kaydı silinemedi.', 'error');
      } finally {
        busy = false;
        updateControls();
      }
    });

    nodes.exportButton.addEventListener('click', async () => {
      if (busy || !authenticated) return;
      if (typeof BlobImpl !== 'function' || typeof urlApi?.createObjectURL !== 'function' || typeof urlApi?.revokeObjectURL !== 'function') {
        setStatus('Bu tarayıcı bellek dışa aktarmayı desteklemiyor.', 'error');
        return;
      }
      busy = true;
      updateControls();
      setStatus('Kişisel bellek dışa aktarılıyor…', 'loading');
      let objectUrl = '';
      try {
        const response = await client.exportAll();
        if (!response.ok) {
          setStatus(messageFor(response), 'error');
          if (response.status === 401) await refreshSession();
          return;
        }
        const exported = createExportText(response.payload?.records, { now });
        const blob = new BlobImpl([exported.text], { type: 'application/json;charset=utf-8' });
        objectUrl = urlApi.createObjectURL(blob);
        const link = documentRef.createElement('a');
        link.href = objectUrl;
        link.download = exported.filename;
        link.hidden = true;
        documentRef.body.append(link);
        link.click();
        link.remove();
        setStatus(`${exported.count} kişisel bellek kaydı JSON olarak dışa aktarıldı.`, 'active');
      } catch (error) {
        setStatus(error?.message === 'MEMORY_EXPORT_TOO_LARGE'
          ? 'Bellek dışa aktarma dosyası tarayıcı sınırını aşıyor.'
          : 'Kişisel bellek dışa aktarılamadı.', 'error');
      } finally {
        if (objectUrl) urlApi.revokeObjectURL(objectUrl);
        busy = false;
        updateControls();
      }
    });

    nodes.deleteAllButton.addEventListener('click', async () => {
      if (busy || !authenticated) return;
      if (typeof confirmImpl !== 'function') {
        setStatus('Tam silme onayı bu ortamda kullanılamıyor.', 'error');
        return;
      }
      const first = confirmImpl('Tüm kişisel bellek kayıtlarını kalıcı olarak silmek istiyor musun?');
      if (!first) return;
      const second = confirmImpl('Bu işlem geri alınamaz. Tüm kişisel belleği silmeyi onaylıyor musun?');
      if (!second) {
        setStatus('Tüm belleği silme işlemi iptal edildi.', 'idle');
        return;
      }
      busy = true;
      updateControls();
      setStatus('Tüm kişisel bellek kayıtları siliniyor…', 'loading');
      try {
        const response = await client.removeAll();
        if (!response.ok) {
          setStatus(messageFor(response), 'error');
          if (response.status === 401) await refreshSession();
          return;
        }
        clearResults();
        const deleted = Number.isInteger(response.payload?.deleted) ? response.payload.deleted : 0;
        setStatus(`${deleted} kişisel bellek kaydı kalıcı olarak silindi.`, 'active');
      } catch {
        setStatus('Tüm kişisel bellek silinemedi.', 'error');
      } finally {
        busy = false;
        updateControls();
      }
    });

    updateControls();
    refreshSession();
    return true;
  }

  return Object.freeze({
    MEMORY_KINDS,
    MAX_EXPORT_BYTES,
    createMemoryClient,
    normalizeExportRecords,
    createExportText,
    mount
  });
});