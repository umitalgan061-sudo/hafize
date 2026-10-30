// "Uygulamayı yükle" and "Yerel sunucular" on the Settings page, plus the entry points the installed
// app gets from its manifest: shortcuts (?action=new, ?action=voice) and the share sheet (?text=).
import qrcode from 'qrcode-generator';

export interface LocalServer { readonly id: string; readonly name: string; readonly url: string; readonly status: string; readonly kind: string; readonly path: string; readonly command: string }
type InstallPrompt = Event & { prompt: () => Promise<unknown>; userChoice?: Promise<{ outcome: string }> };

const SERVER_POLL_MS = 20_000;

export type DeviceKind = 'installed' | 'ios' | 'android' | 'desktop';

export function deviceKind({ standalone, userAgent, maxTouchPoints = 0 }: { readonly standalone: boolean; readonly userAgent: string; readonly maxTouchPoints?: number }): DeviceKind {
  if (standalone) return 'installed';
  // iPadOS reports a Mac user agent, but a Mac has no touch screen.
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

/** Text carried in by the share sheet, or null when the app was opened normally. */
export function sharedText(search: string): string | null {
  const params = new URLSearchParams(search);
  const text = [params.get('title'), params.get('text'), params.get('url')].map((part) => part?.trim()).filter(Boolean).join('\n');
  return text ? text.slice(0, 20_000) : null;
}

export function qrSvg(text: string): string {
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  return code.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
}

function start(documentRef: Document, root: typeof globalThis): void {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const api = (path: string, init?: RequestInit) => ((root as typeof globalThis & { HafizeAuth?: { fetch: typeof fetch } }).HafizeAuth?.fetch ?? root.fetch.bind(root))(path, init);

  let installPrompt: InstallPrompt | null = null;
  let renderDevice: () => void = () => {};
  root.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event as InstallPrompt; renderDevice(); });
  root.addEventListener('appinstalled', () => { installPrompt = null; renderDevice(); });

  const installPanel = () => {
    const panel = el('section', 'settings-panel app-install');
    panel.append(el('h2', '', 'Uygulamayı yükle'), el('p', '', 'Hafize kendi penceresinde, tarayıcı çubuğu olmadan açılır. Veriler yine bu bilgisayardaki sunucuda kalır.'));
    const device = el('div', 'app-install-device');
    const phone = el('div', 'app-install-phone');
    panel.append(device, phone);

    renderDevice = () => {
      const standalone = root.matchMedia?.('(display-mode: standalone)').matches || (root.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const kind = deviceKind({ standalone, userAgent: root.navigator.userAgent, maxTouchPoints: root.navigator.maxTouchPoints });
      device.replaceChildren();
      if (kind === 'installed') { device.append(el('p', 'app-install-state', 'Hafize bu cihazda uygulama olarak açık.')); return; }
      if (!root.isSecureContext) { device.append(el('p', 'app-install-state', 'Bu adres güvenli değil, tarayıcı yüklemeye izin vermez. Aşağıdaki HTTPS adresini kullan.')); return; }
      if (installPrompt) {
        const install = el('button', 'app-install-primary', 'Bu cihaza yükle');
        install.type = 'button';
        install.addEventListener('click', () => {
          const prompt = installPrompt;
          installPrompt = null;
          void prompt?.prompt().catch(() => {}).finally(renderDevice);
        });
        device.append(install);
        return;
      }
      device.append(el('p', 'app-install-state', kind === 'ios'
        ? 'iPhone ve iPad’de Safari’nin Paylaş menüsünden “Ana Ekrana Ekle”yi seç.'
        : kind === 'android'
          ? 'Chrome menüsünden “Uygulamayı yükle”yi seç.'
          : 'Adres çubuğundaki yükleme simgesini ya da tarayıcı menüsündeki “Uygulama olarak yükle”yi kullan.'));
    };

    void api('/api/install-info').then((response) => (response.ok ? response.json() : null)).then((info) => {
      phone.replaceChildren(el('h3', '', 'Telefona yükle'));
      const urls: string[] = Array.isArray(info?.https?.urls) ? info.https.urls : [];
      if (!urls.length) {
        phone.append(el('p', 'app-install-state', 'Telefon erişimi kapalı. Açmak için .env dosyasına HAFIZE_HTTPS_PORT=4443 ekleyip sunucuyu yeniden başlat.'));
        return;
      }
      for (const url of urls) {
        const row = el('div', 'app-install-qr');
        const code = el('div', 'app-install-code');
        code.setAttribute('role', 'img');
        code.setAttribute('aria-label', `${url} adresinin karekodu`);
        code.innerHTML = qrSvg(url); // Generated locally from a URL the server reported; no user markup.
        const text = el('div', 'app-install-qr-text');
        text.append(el('strong', '', url));
        const steps = el('ol');
        steps.append(
          el('li', '', 'Telefon bu bilgisayarla aynı ağda olsun, karekodu okut. İlk açılışta çıkan güvenlik uyarısında “Gelişmiş > Devam et”i seç.'),
          (() => { const li = el('li'); li.append('Sertifikayı indirip kur: '); const link = el('a', '', 'hafize-ca.crt'); link.href = `${new URL(url).origin}/hafize-ca.crt`; li.append(link, '. Android: Ayarlar > Güvenlik > Sertifika yükle > CA. iPhone: Ayarlar > İndirilen Profil, ardından Genel > Hakkında > Sertifika Güven Ayarları.'); return li; })(),
          el('li', '', 'Sayfayı yenile, erişim anahtarınla giriş yap ve tarayıcı menüsünden “Uygulamayı yükle / Ana Ekrana Ekle”yi seç.')
        );
        text.append(steps);
        row.append(code, text);
        phone.append(row);
      }
      phone.append(el('p', 'task-note', 'Sertifika yalnızca yerel ağ adresleri için geçerlidir, başka siteleri etkilemez. Bilgisayar açık ve Hafize çalışır durumda olmalı. Bağlanamazsan Windows Güvenlik Duvarı’nda 4443 portuna izin ver.'));
    }).catch(() => {});

    renderDevice();
    return panel;
  };

  const serversPanel = () => {
    const panel = el('section', 'settings-panel local-servers');
    panel.append(el('h2', '', 'Yerel sunucular'), el('p', '', 'Hafize’nin bu bilgisayarda başlattığı siteler ve uygulamalar. Sayı sınırı yok; sohbette “bu klasörü localhost’ta aç” demen yeterli.'));
    const list = el('ul', 'settings-memory-list local-server-list');
    panel.append(list);
    const refresh = async () => {
      let servers: LocalServer[] = [];
      try {
        const response = await api('/api/localhost');
        if (!response.ok) return;
        const data = await response.json();
        servers = Array.isArray(data?.servers) ? data.servers : [];
      } catch { return; }
      list.replaceChildren();
      if (!servers.length) { list.append(el('li', 'settings-memory-empty', 'Şu an çalışan yerel sunucu yok.')); return; }
      for (const server of servers) {
        const running = server.status === 'running';
        const item = el('li', running ? 'local-server' : 'local-server is-stopped');
        const head = el('div', 'local-server-head');
        head.append(el('strong', '', server.name));
        if (running && server.url) {
          const link = el('a', '', server.url);
          link.href = server.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          head.append(link);
        } else head.append(el('small', '', server.status === 'starting' ? 'Başlıyor…' : 'Durdu'));
        const action = el('button', '', running || server.status === 'starting' ? 'Durdur' : 'Kaldır');
        action.type = 'button';
        action.setAttribute('aria-label', `${server.name}: ${action.textContent}`);
        action.addEventListener('click', () => { void api(`/api/localhost/${encodeURIComponent(server.id)}/stop`, { method: 'POST' }).finally(refresh); });
        item.append(head, action);
        list.append(item);
      }
    };
    void refresh();
    setInterval(() => { if (panel.isConnected && panel.offsetParent !== null) void refresh(); }, SERVER_POLL_MS);
    return panel;
  };

  const attach = (host: Element) => {
    if (host.querySelector('.app-install')) return;
    const first = host.querySelector('.settings-panel');
    if (first?.nextSibling) host.insertBefore(installPanel(), first.nextSibling); else host.append(installPanel());
    const results = host.querySelector('.task-results') ?? host.querySelector('.app-install');
    const servers = serversPanel();
    if (results?.nextSibling) host.insertBefore(servers, results.nextSibling); else host.append(servers);
  };
  const host = documentRef.querySelector('.settings-workspace');
  if (host) attach(host);
  else {
    // settings-workspace.ts builds its page while the app starts; watch once, then stop.
    const watcher = new root.MutationObserver(() => {
      const found = documentRef.querySelector('.settings-workspace');
      if (found) { watcher.disconnect(); attach(found); }
    });
    watcher.observe(documentRef.documentElement, { childList: true, subtree: true });
  }

  // Manifest entry points. Run once, after the app shell has had its chance to bind the buttons.
  root.setTimeout(() => {
    const params = new URLSearchParams(root.location.search);
    const action = params.get('action');
    if (action === 'new') documentRef.querySelector<HTMLElement>('#newChatBtn')?.click();
    if (action === 'voice') documentRef.querySelector<HTMLElement>('#micBtn')?.click();
    const shared = sharedText(root.location.search);
    const input = documentRef.querySelector<HTMLTextAreaElement>('#messageInput');
    if (shared && input) {
      input.value = shared;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
    if (root.location.search) root.history.replaceState(null, '', root.location.pathname);
  }, 400);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(document, globalThis), { once: true });
  else start(document, globalThis);
}
