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
  const APPROVAL_PATH = '/api/memory/approval/prepare';
  const APPROVAL_HEADER = 'X-Hafize-Memory-Approval';
  const SESSION_STATUS_PATH = '/api/session/status';
  const MEMORY_ID = /^memory_[A-Za-z0-9_-]{8,80}$/;
  const APPROVAL_TOKEN = /^mw1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
  const MEMORY_KINDS = Object.freeze(['identity', 'preference', 'project', 'note']);
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

    async function approvedRequest(command, path, init) {
      const prepared = await request(APPROVAL_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      if (!prepared.ok) return prepared;
      const token = typeof prepared.payload?.approvalToken === 'string' ? prepared.payload.approvalToken.trim() : '';
      if (!APPROVAL_TOKEN.test(token)) {
        return Object.freeze({ ok: false, status: 502, payload: Object.freeze({ error: 'MEMORY_APPROVAL_INVALID' }) });
      }
      return request(path, {
        ...init,
        headers: { ...(init.headers || {}), [APPROVAL_HEADER]: token }
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
        const body = {
          kind,
          content: cleanContent,
          sourceType: 'user_note',
          sensitivity: 'personal',
          explicitUserIntent: true
        };
        return approvedRequest({ kind: 'write', body }, MEMORY_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      },
      remove(memoryId) {
        if (typeof memoryId !== 'string' || !MEMORY_ID.test(memoryId)) throw new Error('INVALID_MEMORY_ID');
        const body = { exactMatch: true, explicitUserIntent: true };
        return approvedRequest({ kind: 'delete-one', memoryId, body }, `${MEMORY_PATH}/${encodeURIComponent(memoryId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
    });
  }

  function messageFor(response) {
    const code = response?.payload?.error;
    if (response?.status === 401 || code === 'AUTH_REQUIRED') return 'Bellek için önce güvenli oturum aç.';
    if (response?.status === 403 || code === 'ORIGIN_REQUIRED') return 'Bu işlem yalnız güvenli Hafize adresinden yapılabilir.';
    if (code === 'MEMORY_APPROVAL_REQUIRED') return 'Bellek değişikliği için yeni açık onay gerekli.';
    if (code === 'MEMORY_APPROVAL_EXPIRED') return 'Bellek onayının süresi doldu; işlemi yeniden başlat.';
    if (code === 'MEMORY_APPROVAL_REPLAYED' || code === 'MEMORY_APPROVAL_MISMATCH') return 'Bellek onayı bu exact işlem için geçerli değil; işlemi yeniden başlat.';
    if (response?.status === 404) return 'Kişisel bellek sunucuda henüz yapılandırılmamış.';
    if (code === 'MEMORY_OPERATION_FAILED') return 'Bellek işlemi doğrulanamadı.';
    return 'Bellek işlemi tamamlanamadı.';
  }

  function mount({ documentRef = globalThis.document, fetchImpl = globalThis.fetch } = {}) {
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
      writeButton: documentRef.querySelector('#memoryWriteBtn')
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
          setStatus('Kişisel belleğini ara veya açıkça yeni bir not kaydet.', 'active');
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

    updateControls();
    refreshSession();
    return true;
  }

  return Object.freeze({ MEMORY_KINDS, createMemoryClient, mount });
});