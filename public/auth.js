(() => {
  'use strict';

  const originalFetch = window.fetch.bind(window);
  const state = { required: false, authenticated: false, csrf: '', loading: null, modal: null };
  const protectedPrefixes = ['/api/'];
  const authPaths = new Set(['/api/auth/session', '/api/auth/login', '/api/auth/logout']);

  function isApi(url) {
    try {
      const value = new URL(url, window.location.href);
      return value.origin === window.location.origin && protectedPrefixes.some((prefix) => value.pathname.startsWith(prefix));
    } catch {
      return false;
    }
  }

  function isAuthPath(url) {
    try {
      return authPaths.has(new URL(url, window.location.href).pathname);
    } catch {
      return false;
    }
  }

  function createModal() {
    if (state.modal) return state.modal;
    const style = document.createElement('style');
    style.textContent = `
      .hafize-auth-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(16,20,25,.46);backdrop-filter:blur(10px)}
      .hafize-auth-card{width:min(420px,100%);border:1px solid rgba(120,125,130,.24);border-radius:24px;padding:26px;background:var(--panel,#fff);box-shadow:0 24px 80px rgba(0,0,0,.22)}
      .hafize-auth-card h2{margin:0 0 8px;font-size:22px}.hafize-auth-card p{margin:0 0 18px;opacity:.72;line-height:1.5}.hafize-auth-card label{display:block;font-size:13px;font-weight:700;margin-bottom:8px}.hafize-auth-card input{width:100%;box-sizing:border-box;border:1px solid rgba(120,125,130,.35);border-radius:14px;padding:12px 14px;background:transparent;color:inherit}.hafize-auth-card button{width:100%;margin-top:14px;border:0;border-radius:14px;padding:12px 14px;font-weight:700;cursor:pointer;background:currentColor;color:var(--panel,#fff)}
      .hafize-auth-card button span{color:var(--panel,#fff)}
      .hafize-auth-error{min-height:20px;margin-top:10px;font-size:13px;color:#a52323}.hafize-auth-card[aria-busy="true"]{pointer-events:none;opacity:.8}
    `;
    document.head.append(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'hafize-auth-backdrop';
    backdrop.innerHTML = `
      <form class="hafize-auth-card" aria-label="Hafize giriş" autocomplete="off">
        <h2>Hafize'ye giriş</h2>
        <p>Bu Hafize sunucusu korunuyor. Erişim anahtarın sunucuda doğrulanır ve tarayıcıya kalıcı olarak kaydedilmez.</p>
        <label for="hafizeAuthToken">Erişim anahtarı</label>
        <input id="hafizeAuthToken" type="password" minlength="32" autocomplete="current-password" spellcheck="false" required />
        <div class="hafize-auth-error" role="alert"></div>
        <button type="submit"><span>Giriş yap</span></button>
      </form>`;
    document.body.append(backdrop);
    const form = backdrop.querySelector('form');
    const input = backdrop.querySelector('input');
    const error = backdrop.querySelector('.hafize-auth-error');
    state.modal = { backdrop, form, input, error };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      form.setAttribute('aria-busy', 'true');
      try {
        const response = await originalFetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ token: input.value })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.authenticated) throw new Error(payload.error || 'AUTH_REQUIRED');
        state.authenticated = true;
        state.csrf = typeof payload.csrf === 'string' ? payload.csrf : '';
        input.value = '';
        backdrop.remove();
        state.modal = null;
      } catch (loginError) {
        error.textContent = loginError?.message === 'AUTH_REQUIRED' ? 'Erişim anahtarı geçersiz.' : 'Giriş yapılamadı. Sunucu bağlantısını kontrol et.';
      } finally {
        form.removeAttribute('aria-busy');
        if (state.modal) input.focus();
      }
    });
    return state.modal;
  }

  function openLogin() {
    const modal = createModal();
    if (!document.body.contains(modal.backdrop)) document.body.append(modal.backdrop);
    modal.input.focus();
  }

  async function refreshSession() {
    if (state.loading) return state.loading;
    state.loading = (async () => {
      const response = await originalFetch('/api/auth/session', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('AUTH_SESSION_FAILED');
      const payload = await response.json();
      state.required = Boolean(payload?.required);
      state.authenticated = Boolean(payload?.authenticated);
      state.csrf = typeof payload?.csrf === 'string' ? payload.csrf : '';
      return state;
    })();
    try {
      return await state.loading;
    } finally {
      state.loading = null;
    }
  }

  async function ensureAuth() {
    await refreshSession();
    if (!state.required || state.authenticated) return;
    openLogin();
    while (!state.authenticated) {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      await refreshSession();
    }
  }

  function addCsrf(init) {
    const next = { ...(init || {}) };
    const headers = new Headers(next.headers || {});
    if (state.csrf) headers.set('X-Hafize-CSRF', state.csrf);
    next.headers = headers;
    next.credentials = 'same-origin';
    return next;
  }

  window.fetch = async function hafizeAuthenticatedFetch(input, init = {}) {
    if (!isApi(input) || isAuthPath(input)) return originalFetch(input, init);

    await ensureAuth();
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let response = await originalFetch(input, method === 'GET' || method === 'HEAD' ? { ...init, credentials: 'same-origin' } : addCsrf(init));
    if (response.status !== 401) return response;

    state.authenticated = false;
    state.csrf = '';
    await ensureAuth();
    response = await originalFetch(input, method === 'GET' || method === 'HEAD' ? { ...init, credentials: 'same-origin' } : addCsrf(init));
    return response;
  };

  window.HafizeAuth = Object.freeze({
    ready: refreshSession().catch(() => state),
    get state() { return { required: state.required, authenticated: state.authenticated }; },
    login: openLogin
  });
})();
