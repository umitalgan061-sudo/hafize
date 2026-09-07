(() => {
  'use strict';
  const rawFetch = window.fetch.bind(window), state = { required: false, authenticated: false, csrf: '', loading: null, modal: null }, authPaths = new Set(['/api/auth/session', '/api/auth/login', '/api/auth/logout']);
  const apiPath = (value) => { try { const u = new URL(value, location.href); return u.origin === location.origin && u.pathname.startsWith('/api/'); } catch { return false; } };
  const authPath = (value) => { try { return authPaths.has(new URL(value, location.href).pathname); } catch { return false; } };
  function modal() {
    if (state.modal) return state.modal;
    const style = document.createElement('style'); style.textContent = '.hafize-auth-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(16,20,25,.46);backdrop-filter:blur(10px)}.hafize-auth-card{width:min(420px,100%);box-sizing:border-box;border:1px solid rgba(120,125,130,.24);border-radius:24px;padding:26px;background:var(--panel,#fff);box-shadow:0 24px 80px rgba(0,0,0,.22)}.hafize-auth-card h2{margin:0 0 8px}.hafize-auth-card p{margin:0 0 18px;opacity:.72;line-height:1.5}.hafize-auth-card label{display:block;font-size:13px;font-weight:700;margin-bottom:8px}.hafize-auth-card input{width:100%;box-sizing:border-box;border:1px solid rgba(120,125,130,.35);border-radius:14px;padding:12px 14px;background:transparent;color:inherit}.hafize-auth-card button{width:100%;margin-top:14px;border:0;border-radius:14px;padding:12px;font-weight:700;cursor:pointer}.hafize-auth-error{min-height:20px;margin-top:10px;font-size:13px;color:#a52323}'; document.head.append(style);
    const backdrop = document.createElement('div'); backdrop.className = 'hafize-auth-backdrop';
    backdrop.innerHTML = '<form class="hafize-auth-card" aria-label="Hafize giriş" autocomplete="off"><h2>Hafize\'ye giriş</h2><p>Bu Hafize sunucusu korunuyor. Erişim anahtarın kalıcı olarak tarayıcıya kaydedilmez.</p><label for="hafizeAuthToken">Erişim anahtarı</label><input id="hafizeAuthToken" type="password" minlength="32" autocomplete="current-password" required><div class="hafize-auth-error" role="alert"></div><button type="submit">Giriş yap</button></form>';
    document.body.append(backdrop); const form = backdrop.querySelector('form'), input = backdrop.querySelector('input'), error = backdrop.querySelector('.hafize-auth-error'); state.modal = { backdrop, form, input, error };
    form.addEventListener('submit', async (event) => { event.preventDefault(); error.textContent = ''; form.setAttribute('aria-busy', 'true'); try { const response = await rawFetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ token: input.value }) }); const payload = await response.json().catch(() => ({})); if (!response.ok || !payload.authenticated) throw new Error(payload.error || 'AUTH_REQUIRED'); state.authenticated = true; state.csrf = typeof payload.csrf === 'string' ? payload.csrf : ''; input.value = ''; backdrop.remove(); state.modal = null; } catch (loginError) { error.textContent = loginError?.message === 'AUTH_REQUIRED' ? 'Erişim anahtarı geçersiz.' : 'Giriş yapılamadı. Sunucu bağlantısını kontrol et.'; } finally { form.removeAttribute('aria-busy'); if (state.modal) input.focus(); } });
    return state.modal;
  }
  const openLogin = () => { const value = modal(); if (!document.body.contains(value.backdrop)) document.body.append(value.backdrop); value.input.focus(); };
  async function refresh() {
    if (state.loading) return state.loading;
    state.loading = (async () => { const response = await rawFetch('/api/auth/session', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!response.ok) throw new Error('AUTH_SESSION_FAILED'); const payload = await response.json(); state.required = Boolean(payload?.required); state.authenticated = Boolean(payload?.authenticated); state.csrf = typeof payload?.csrf === 'string' ? payload.csrf : ''; return state; })();
    try { return await state.loading; } finally { state.loading = null; }
  }
  async function ensure() { await refresh(); if (!state.required || state.authenticated) return; openLogin(); while (!state.authenticated) { await new Promise((resolve) => setTimeout(resolve, 200)); await refresh(); } }
  window.fetch = async function hafizeFetch(input, init = {}) {
    if (!apiPath(input) || authPath(input)) return rawFetch(input, init);
    await ensure(); const next = { ...init, credentials: 'same-origin' }, method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) { next.headers = new Headers(next.headers || {}); if (state.csrf) next.headers.set('X-Hafize-CSRF', state.csrf); }
    let response = await rawFetch(input, next); if (response.status !== 401) return response;
    state.authenticated = false; state.csrf = ''; await ensure(); if (!['GET', 'HEAD'].includes(method)) { next.headers.set('X-Hafize-CSRF', state.csrf); }
    return rawFetch(input, next);
  };
  window.HafizeAuth = Object.freeze({ ready: refresh().catch(() => state), login: openLogin, get state() { return { required: state.required, authenticated: state.authenticated }; } });
})();
