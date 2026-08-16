(function exposeHafizeCloudSessionUi(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeCloudSessionUi = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCloudSessionUi() {
  'use strict';

  const PATHS = Object.freeze({
    login: '/api/session/login',
    status: '/api/session/status',
    logout: '/api/session/logout',
    gmailStatus: '/api/connectors/gmail/status',
    gmailStart: '/api/connectors/gmail/oauth/start',
    gmailCallback: '/api/connectors/gmail/oauth/callback',
    gmailDisconnect: '/api/connectors/gmail/disconnect'
  });
  const GOOGLE_HOST = 'accounts.google.com';
  const GOOGLE_CAPABILITIES = Object.freeze(['identity', 'gmail.read']);
  const POPUP_NAME = 'hafizeGoogleOAuth';
  const POPUP_FEATURES = 'popup,width=540,height=760,resizable=yes,scrollbars=yes';
  const OAUTH_POLL_MS = 350;
  const OAUTH_TIMEOUT_MS = 10 * 60 * 1000;

  function safeText(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function normalizeAuthorizationUrl(value) {
    let url;
    try { url = new URL(safeText(value)); } catch { throw new Error('INVALID_GOOGLE_AUTHORIZATION_URL'); }
    if (url.protocol !== 'https:' || url.hostname !== GOOGLE_HOST || url.port || url.username || url.password || url.hash) {
      throw new Error('INVALID_GOOGLE_AUTHORIZATION_URL');
    }
    return url.toString();
  }

  async function readPayload(response) {
    try {
      const payload = await response.json();
      return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    } catch {
      return {};
    }
  }

  function createAccountClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_ACCOUNT_CLIENT_FETCH');

    async function request(path, init = {}) {
      const headers = { Accept: 'application/json', ...(init.headers || {}) };
      const response = await fetchImpl(path, {
        ...init,
        headers,
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
        return request(PATHS.status, { method: 'GET' });
      },
      login(password) {
        if (typeof password !== 'string' || !password) throw new Error('PASSWORD_REQUIRED');
        return request(PATHS.login, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
      },
      logout() {
        return request(PATHS.logout, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
      },
      gmailStatus() {
        return request(PATHS.gmailStatus, { method: 'GET' });
      },
      disconnectGmail() {
        return request(PATHS.gmailDisconnect, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ explicitUserIntent: true })
        });
      },
      async startGmailOAuth() {
        const response = await request(PATHS.gmailStart, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capabilities: GOOGLE_CAPABILITIES })
        });
        if (!response.ok) return response;
        return Object.freeze({
          ...response,
          authorizationUrl: normalizeAuthorizationUrl(response.payload.authorizationUrl)
        });
      }
    });
  }

  function inspectOAuthPopup(popup, origin) {
    if (!popup || popup.closed) return Object.freeze({ state: 'closed' });
    try {
      const href = safeText(popup.location?.href);
      if (!href || href === 'about:blank') return Object.freeze({ state: 'pending' });
      const url = new URL(href);
      if (url.origin !== origin || url.pathname !== PATHS.gmailCallback) return Object.freeze({ state: 'pending' });
      const text = safeText(popup.document?.body?.textContent, '{}');
      let payload;
      try { payload = JSON.parse(text); } catch { payload = {}; }
      if (payload?.linked === true) return Object.freeze({ state: 'complete', linked: true });
      return Object.freeze({
        state: 'complete',
        linked: false,
        error: safeText(payload?.error, 'GOOGLE_OAUTH_FAILED')
      });
    } catch {
      return Object.freeze({ state: 'pending' });
    }
  }

  function waitForOAuthPopup(popup, {
    origin = globalThis.location?.origin,
    pollMs = OAUTH_POLL_MS,
    timeoutMs = OAUTH_TIMEOUT_MS,
    setIntervalImpl = globalThis.setInterval,
    clearIntervalImpl = globalThis.clearInterval,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (typeof origin !== 'string' || !origin) return Promise.reject(new Error('INVALID_OAUTH_POPUP_ORIGIN'));
    if (typeof setIntervalImpl !== 'function' || typeof clearIntervalImpl !== 'function' ||
        typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
      return Promise.reject(new Error('INVALID_OAUTH_POPUP_TIMER'));
    }

    return new Promise((resolve) => {
      let settled = false;
      let intervalId;
      let timeoutId;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearIntervalImpl(intervalId);
        clearTimeoutImpl(timeoutId);
        resolve(value);
      };
      intervalId = setIntervalImpl(() => {
        const result = inspectOAuthPopup(popup, origin);
        if (result.state !== 'pending') finish(result);
      }, pollMs);
      timeoutId = setTimeoutImpl(() => finish(Object.freeze({ state: 'timeout' })), timeoutMs);
    });
  }

  function errorMessage(code) {
    const messages = {
      AUTH_REQUIRED: 'Oturum gerekli.',
      ORIGIN_REQUIRED: 'Bu işlem yalnız güvenli Hafize adresinden yapılabilir.',
      RATE_LIMITED: 'Çok fazla giriş denemesi yapıldı. Biraz sonra tekrar dene.',
      BODY_TOO_LARGE: 'Giriş isteği beklenenden büyük.',
      REQUEST_TIMEOUT: 'Giriş isteği zaman aşımına uğradı.',
      UNSUPPORTED_MEDIA_TYPE: 'İstek biçimi desteklenmiyor.',
      GOOGLE_OAUTH_REAUTH_REQUIRED: 'Google yeniden izin istiyor. Bağlantıyı tekrar başlat.',
      OAUTH_PROVIDER_DENIED: 'Google izin isteği tamamlanmadı.',
      OAUTH_TEMPORARILY_UNAVAILABLE: 'Google bağlantısı geçici olarak kullanılamıyor.',
      GOOGLE_OAUTH_UPSTREAM_FAILED: 'Google bağlantısı tamamlanamadı.',
      GOOGLE_OAUTH_UPSTREAM_TIMEOUT: 'Google yanıtı zaman aşımına uğradı.',
      GOOGLE_REVOKE_UPSTREAM_FAILED: 'Google erişim izni kaldırılamadı.',
      GOOGLE_REVOKE_UPSTREAM_TIMEOUT: 'Google izin kaldırma yanıtı zaman aşımına uğradı.',
      GOOGLE_DISCONNECT_TEMPORARILY_UNAVAILABLE: 'Gmail bağlantısı şu anda güvenle kaldırılamıyor.'
    };
    return messages[safeText(code)] || 'İşlem tamamlanamadı.';
  }

  function mount({ documentRef = globalThis.document, windowRef = globalThis.window, fetchImpl = globalThis.fetch } = {}) {
    if (!documentRef || !windowRef) return false;
    const nodes = {
      card: documentRef.querySelector('#accountConnectionCard'),
      badge: documentRef.querySelector('#sessionBadge'),
      status: documentRef.querySelector('#sessionStatusText'),
      loginForm: documentRef.querySelector('#sessionLoginForm'),
      password: documentRef.querySelector('#sessionPassword'),
      loginButton: documentRef.querySelector('#sessionLoginBtn'),
      actions: documentRef.querySelector('#sessionActions'),
      gmailStatus: documentRef.querySelector('#gmailConnectionStatus'),
      gmailButton: documentRef.querySelector('#gmailConnectBtn'),
      logoutButton: documentRef.querySelector('#sessionLogoutBtn')
    };
    if (Object.values(nodes).some((node) => !node)) return false;

    const client = createAccountClient({ fetchImpl });
    let authenticated = false;
    let gmailLinked = false;
    let busy = false;

    function setBadge(kind, text) {
      nodes.badge.dataset.state = kind;
      nodes.badge.textContent = text;
    }

    function setAuthenticated(value) {
      authenticated = Boolean(value);
      nodes.loginForm.hidden = authenticated;
      nodes.actions.hidden = !authenticated;
      nodes.gmailButton.disabled = busy || !authenticated;
      nodes.logoutButton.disabled = busy || !authenticated;
      nodes.loginButton.disabled = busy;
      nodes.password.disabled = busy;
      if (!authenticated) {
        gmailLinked = false;
        nodes.gmailStatus.textContent = 'Gmail için önce güvenli oturum aç.';
        nodes.gmailStatus.dataset.state = 'idle';
      }
    }

    function setBusy(value) {
      busy = Boolean(value);
      setAuthenticated(authenticated);
      nodes.card.setAttribute('aria-busy', String(busy));
    }

    function describeSessionFailure(response) {
      if (response.status === 404) return 'Cloud oturumu sunucuda henüz yapılandırılmamış.';
      if (response.status === 401) return 'Güvenli oturum kapalı.';
      return errorMessage(response.payload?.error);
    }

    async function refreshGmail() {
      if (!authenticated) return;
      nodes.gmailStatus.dataset.state = 'loading';
      nodes.gmailStatus.textContent = 'Gmail bağlantısı kontrol ediliyor…';
      try {
        const response = await client.gmailStatus();
        if (response.ok) {
          gmailLinked = response.payload?.linked === true;
          nodes.gmailStatus.dataset.state = gmailLinked ? 'linked' : 'unlinked';
          nodes.gmailStatus.textContent = gmailLinked
            ? 'Gmail bağlı · okuma erişimi hazır.'
            : 'Gmail henüz bağlı değil.';
          nodes.gmailButton.textContent = gmailLinked ? 'Gmail bağlantısını kaldır' : 'Gmail’i bağla';
          return;
        }
        nodes.gmailStatus.dataset.state = 'error';
        nodes.gmailStatus.textContent = response.status === 404
          ? 'Gmail bağlantısı sunucuda yapılandırılmamış.'
          : errorMessage(response.payload?.error);
      } catch {
        nodes.gmailStatus.dataset.state = 'error';
        nodes.gmailStatus.textContent = 'Gmail bağlantı durumu alınamadı.';
      }
    }

    async function refreshSession({ quiet = false } = {}) {
      if (!quiet) {
        setBadge('loading', 'Kontrol');
        nodes.status.textContent = 'Güvenli oturum kontrol ediliyor…';
      }
      try {
        const response = await client.sessionStatus();
        if (response.ok && response.payload?.authenticated === true) {
          setAuthenticated(true);
          setBadge('active', 'Açık');
          nodes.status.textContent = 'Güvenli cloud oturumu açık.';
          await refreshGmail();
          return true;
        }
        setAuthenticated(false);
        setBadge(response.status === 404 ? 'disabled' : 'idle', response.status === 404 ? 'Kapalı' : 'Giriş');
        nodes.status.textContent = describeSessionFailure(response);
        return false;
      } catch {
        setAuthenticated(false);
        setBadge('error', 'Hata');
        nodes.status.textContent = 'Cloud oturum durumu alınamadı.';
        return false;
      }
    }

    nodes.loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      const password = nodes.password.value;
      if (!password) {
        nodes.status.textContent = 'Parolanı gir.';
        nodes.password.focus();
        return;
      }
      setBusy(true);
      setBadge('loading', 'Giriş');
      nodes.status.textContent = 'Güvenli oturum açılıyor…';
      try {
        const response = await client.login(password);
        nodes.password.value = '';
        if (!response.ok) {
          setAuthenticated(false);
          setBadge('error', 'Reddedildi');
          nodes.status.textContent = response.status === 401 ? 'Parola doğrulanamadı.' : errorMessage(response.payload?.error);
          return;
        }
        setAuthenticated(true);
        setBadge('active', 'Açık');
        nodes.status.textContent = 'Güvenli cloud oturumu açıldı.';
        await refreshGmail();
      } catch {
        setBadge('error', 'Hata');
        nodes.status.textContent = 'Cloud oturumu açılamadı.';
      } finally {
        setBusy(false);
      }
    });

    nodes.logoutButton.addEventListener('click', async () => {
      if (busy || !authenticated) return;
      setBusy(true);
      nodes.status.textContent = 'Oturum kapatılıyor…';
      try {
        const response = await client.logout();
        if (!response.ok) {
          nodes.status.textContent = errorMessage(response.payload?.error);
          return;
        }
        setAuthenticated(false);
        setBadge('idle', 'Giriş');
        nodes.status.textContent = 'Güvenli oturum kapatıldı.';
      } catch {
        nodes.status.textContent = 'Oturum kapatılamadı.';
      } finally {
        setBusy(false);
      }
    });

    nodes.gmailButton.addEventListener('click', async () => {
      if (busy || !authenticated) return;
      if (gmailLinked) {
        const confirmed = typeof windowRef.confirm === 'function' && windowRef.confirm('Gmail bağlantısını ve Google erişim iznini kaldırmak istiyor musun?');
        if (!confirmed) return;
        setBusy(true);
        nodes.gmailStatus.dataset.state = 'loading';
        nodes.gmailStatus.textContent = 'Google erişim izni kaldırılıyor…';
        try {
          const response = await client.disconnectGmail();
          if (!response.ok) {
            nodes.gmailStatus.dataset.state = 'error';
            nodes.gmailStatus.textContent = errorMessage(response.payload?.error);
            if (response.status === 401) await refreshSession({ quiet: true });
            return;
          }
          gmailLinked = false;
          nodes.gmailStatus.textContent = 'Gmail bağlantısı kaldırıldı.';
          await refreshGmail();
        } catch {
          nodes.gmailStatus.dataset.state = 'error';
          nodes.gmailStatus.textContent = 'Gmail bağlantısı kaldırılamadı.';
        } finally {
          setBusy(false);
        }
        return;
      }
      const popup = windowRef.open('about:blank', POPUP_NAME, POPUP_FEATURES);
      if (!popup) {
        nodes.gmailStatus.dataset.state = 'error';
        nodes.gmailStatus.textContent = 'Google giriş penceresi engellendi. Açılır pencereye izin ver.';
        return;
      }
      try {
        popup.document.title = 'Hafize · Google bağlantısı';
        popup.document.body.textContent = 'Google güvenli bağlantısı hazırlanıyor…';
      } catch {
        // about:blank preparation is best-effort only.
      }

      setBusy(true);
      nodes.gmailStatus.dataset.state = 'loading';
      nodes.gmailStatus.textContent = 'Google izin ekranı hazırlanıyor…';
      try {
        const started = await client.startGmailOAuth();
        if (!started.ok) {
          popup.close();
          nodes.gmailStatus.dataset.state = 'error';
          nodes.gmailStatus.textContent = errorMessage(started.payload?.error);
          if (started.status === 401) await refreshSession({ quiet: true });
          return;
        }
        popup.location.replace(started.authorizationUrl);
        const result = await waitForOAuthPopup(popup, { origin: windowRef.location.origin });
        try { if (!popup.closed) popup.close(); } catch { /* popup may already be gone */ }
        if (result.state === 'complete' && result.linked) {
          nodes.gmailStatus.dataset.state = 'linked';
          nodes.gmailStatus.textContent = 'Google izni tamamlandı; bağlantı doğrulanıyor…';
          await refreshGmail();
          return;
        }
        nodes.gmailStatus.dataset.state = 'error';
        nodes.gmailStatus.textContent = result.state === 'timeout'
          ? 'Google bağlantısı zaman aşımına uğradı.'
          : result.state === 'closed'
            ? 'Google bağlantı penceresi tamamlanmadan kapatıldı.'
            : errorMessage(result.error);
      } catch (error) {
        try { if (!popup.closed) popup.close(); } catch { /* ignore */ }
        nodes.gmailStatus.dataset.state = 'error';
        nodes.gmailStatus.textContent = error?.message === 'INVALID_GOOGLE_AUTHORIZATION_URL'
          ? 'Sunucu güvenli olmayan bir Google yönlendirmesi döndürdü; işlem durduruldu.'
          : 'Google bağlantısı başlatılamadı.';
      } finally {
        setBusy(false);
      }
    });

    windowRef.addEventListener('pageshow', () => refreshSession({ quiet: authenticated }));
    documentRef.addEventListener('visibilitychange', () => {
      if (documentRef.visibilityState === 'visible' && authenticated && !busy) refreshGmail();
    });
    setAuthenticated(false);
    refreshSession();
    return true;
  }

  return Object.freeze({
    PATHS,
    GOOGLE_CAPABILITIES,
    normalizeAuthorizationUrl,
    createAccountClient,
    inspectOAuthPopup,
    waitForOAuthPopup,
    mount
  });
});
