// "Gelişmiş" section of Settings: what the server-side platform is doing. Every part is a
// collapsed <details> that loads its data only when opened, so Settings stays light.
import { hafizeApi } from './hafize-api.ts';

type Json = Record<string, any>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void | Promise<void>, className = ''): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', async () => {
    node.disabled = true;
    try { await onClick(); } finally { node.disabled = false; }
  });
  return node;
}

function toast(text: string): void {
  const node = document.querySelector('#toast');
  if (!node) return;
  node.textContent = text;
  node.classList.remove('hidden');
  window.setTimeout(() => node.classList.add('hidden'), 2800);
}

const date = (value: unknown) => {
  const time = typeof value === 'number' ? value : Date.parse(String(value || ''));
  return Number.isFinite(time) ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(time)) : '';
};
const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)} sn` : `${Math.round(value)} ms`);

function table(headers: string[], rows: Array<Array<string | number | Node>>): HTMLElement {
  const wrap = el('div', 'platform-table-wrap');
  const tableNode = el('table', 'platform-table');
  const head = el('tr');
  for (const header of headers) head.append(el('th', '', header));
  tableNode.append(head);
  for (const row of rows) {
    const tr = el('tr');
    for (const cell of row) {
      const td = el('td');
      if (cell instanceof Node) td.append(cell); else td.textContent = String(cell);
      tr.append(td);
    }
    tableNode.append(tr);
  }
  wrap.append(tableNode);
  return wrap;
}

function section(title: string, description: string, load: (body: HTMLElement) => Promise<void>): HTMLDetailsElement {
  const details = el('details', 'platform-section');
  const summary = el('summary', '', title);
  const body = el('div', 'platform-body');
  const hint = el('p', 'platform-hint', description);
  details.append(summary, hint, body);
  const refresh = async () => {
    body.replaceChildren(el('p', 'platform-loading', 'Yükleniyor…'));
    try {
      const content = el('div');
      await load(content);
      body.replaceChildren(content, button('Yenile', refresh, 'platform-refresh'));
    } catch (error) {
      body.replaceChildren(el('p', 'platform-error', `Yüklenemedi: ${String((error as Error)?.message || error).slice(0, 160)}`), button('Tekrar dene', refresh));
    }
  };
  details.addEventListener('toggle', () => { if (details.open) void refresh(); });
  return details;
}

const yes = (value: unknown) => (value ? 'Açık' : 'Kapalı');

function buildPanel(): HTMLElement {
  const panel = el('section', 'settings-panel platform-panel');
  panel.id = 'platformPanel';
  panel.append(el('h2', '', 'Gelişmiş'), el('p', '', 'Hafize’nin sunucu tarafındaki yetenekleri: hafıza, araştırma, görevler, uzmanlar, gözlem ve yedekleme. Bölümler açıldığında yüklenir.'));

  panel.append(section('Durum', 'Hangi yeteneklerin bu bilgisayarda hazır olduğu.', async (body) => {
    const caps = await hafizeApi.platform<Json>('/api/capabilities');
    body.append(table(['Yetenek', 'Durum'], [
      ['Şifreli hafıza', `${yes(caps.memory?.encryptedAtRest)} · anlam araması: ${yes(caps.memory?.embeddings)}`],
      ['Araştırma kaynakları', (caps.research?.engines || []).join(', ')],
      ['Görsel analiz', (caps.vision?.models || [])[0] || '—'],
      ['Görsel üretimi', caps.imageGeneration?.model || '—'],
      ['Tarayıcı (sayfa/diyagram)', yes(caps.browser?.available)],
      ['Yerel model (çevrimdışı)', caps.localModel?.enabled ? `Açık · son sağlayıcı: ${caps.localModel?.lastProvider}` : 'Kapalı'],
      ['Yedekleme', caps.backup?.configured ? `Açık (${caps.backup?.target})` : 'Kapalı — .env içinde HAFIZE_BACKUP_DIR ve HAFIZE_BACKUP_PASSPHRASE ayarlanmalı'],
      ['Çalışma klasörü', String(caps.workspace || '')],
      ['Uzman ajan sayısı', String(caps.experts ?? 0)],
      ['OpenTelemetry dışa aktarımı', yes(caps.observability?.otlp)]
    ]));
  }));

  panel.append(section('Gözlem (son 24 saat)', 'Yanıt süreleri, araç başarı oranları, token kullanımı ve geri bildirimler.', async (body) => {
    const data = await hafizeApi.platform<Json>('/api/observability/summary?hours=24');
    const satisfaction = data.feedback?.satisfaction;
    body.append(el('p', 'platform-kpis', `Toplam token: ${Number(data.tokens?.total || 0).toLocaleString('tr-TR')} · Memnuniyet: ${satisfaction === null || satisfaction === undefined ? '—' : `%${Math.round(satisfaction * 100)}`} (👍 ${data.feedback?.up || 0} / 👎 ${data.feedback?.down || 0}) · Doğrulanamayan yanıt: ${data.hallucinationFlags || 0}`));
    body.append(table(['İşlem', 'Adet', 'p50', 'p99', 'Hata'], (data.operations || []).map((op: Json) => [op.name, op.count, ms(op.p50Ms), ms(op.p99Ms), `%${Math.round(op.errorRate * 100)}`])));
    body.append(table(['Araç / beceri', 'Başarılı', 'Hatalı', 'Başarı'], (data.tools || []).map((tool: Json) => [tool.name, tool.ok, tool.error, `%${Math.round(tool.successRate * 100)}`])));
    body.append(table(['Amaç', 'Model', 'Token', 'Çağrı'], (data.tokens?.byModel || []).map((row: Json) => [row.purpose, String(row.model).split('/').pop(), (row.promptTokens + row.completionTokens).toLocaleString('tr-TR'), row.calls])));
    if ((data.feedback?.byVariant || []).length) body.append(table(['Yanıt üslubu (A/B)', '👍', '👎'], data.feedback.byVariant.map((row: Json) => [row.variant, row.up, row.down])));
  }));

  panel.append(section('Uzman ajanlar', 'Alan uzmanları, sağlık durumları ve günlük kotaları.', async (body) => {
    const data = await hafizeApi.platform<Json>('/api/experts');
    body.append(table(['Uzman', 'Yetenekler', 'Güven', 'Sağlık', 'Bugün'], (data.experts || []).map((card: Json) => [
      card.name,
      (card.capabilities || []).slice(0, 5).join(', '),
      card.trustLevel,
      card.health?.healthy ? 'Sağlıklı' : `Sorun: ${(card.health?.reasons || []).join('; ')}`,
      `${card.health?.quota?.calls || 0}/${card.quota?.callsPerDay} çağrı`
    ])));
  }));

  panel.append(section('Çok adımlı görevler', 'Hafize’nin planlayıp yürüttüğü görevler; kayıt noktasından devam edebilir.', async (body) => {
    const data = await hafizeApi.platform<Json>('/api/orchestrator/runs');
    const labels: Record<string, string> = { running: 'Çalışıyor', awaiting_approval: 'Onay bekliyor', succeeded: 'Tamamlandı', failed: 'Başarısız', aborted: 'Durduruldu' };
    if (!(data.runs || []).length) { body.append(el('p', 'platform-empty', 'Henüz çok adımlı görev yok.')); return; }
    body.append(table(['Hedef', 'Durum', 'Güncelleme', ''], (data.runs || []).map((run: Json) => [
      String(run.goal).slice(0, 90),
      labels[run.status] || run.status,
      date(run.updatedAt),
      run.status === 'running' ? button('İptal et', async () => { await hafizeApi.platform(`/api/orchestrator/runs/${run.id}/cancel`, 'POST', {}); toast('Görev iptal edildi.'); }) : ''
    ])));
  }));

  panel.append(section('Geri alınabilir işlemler', 'Hafize’nin yaptığı değişiklikler (hafıza, dosya, görsel); istersen geri alabilirsin.', async (body) => {
    const data = await hafizeApi.listActions();
    if (!(data.actions || []).length) { body.append(el('p', 'platform-empty', 'Kayıtlı işlem yok.')); return; }
    body.append(table(['İşlem', 'Zaman', ''], (data.actions || []).map((action: Json) => [
      String(action.summary),
      date(action.createdAt),
      action.status === 'done' ? button('Geri al', async () => {
        try { await hafizeApi.undoAction(String(action.id)); toast('İşlem geri alındı.'); } catch { toast('Geri alınamadı.'); }
      }) : 'Geri alındı'
    ])));
  }));

  panel.append(section('Görseller', 'Üretilen, yüklenen ve çizilen görseller.', async (body) => {
    const data = await hafizeApi.platform<Json>('/api/images');
    if (!(data.images || []).length) { body.append(el('p', 'platform-empty', 'Henüz görsel yok.')); return; }
    const grid = el('div', 'platform-gallery');
    for (const image of (data.images || []).slice(0, 40)) {
      const figure = el('figure');
      const link = el('a');
      link.href = `/api/images/${image.id}`;
      link.target = '_blank';
      link.rel = 'noopener';
      const img = el('img');
      img.src = `/api/images/${image.id}`;
      img.alt = String(image.prompt || image.model).slice(0, 120);
      img.loading = 'lazy';
      link.append(img);
      const caption = el('figcaption', '', `${String(image.model).replace('upload', 'yüklenen')} · ${date(image.createdAt)}`);
      figure.append(link, caption, button('Sil', async () => { await hafizeApi.platform(`/api/images/${image.id}`, 'DELETE'); figure.remove(); }));
      grid.append(figure);
    }
    body.append(grid);
  }));

  panel.append(section('Beceriler (skills)', 'Hazır ve kullanıcı becerileri; imzalı paket güncellemeleri.', async (body) => {
    const data = await hafizeApi.platform<Json>('/api/skills/catalog');
    body.append(table(['Beceri', 'Açıklama', 'Risk', 'Kaynak'], (data.skills || []).map((skill: Json) => [skill.name, skill.description, skill.riskLevel, skill.source === 'user' ? 'kullanıcı' : 'hazır'])));
    if ((data.errors || []).length) body.append(el('p', 'platform-error', `Yüklenemeyen beceri dosyaları: ${data.errors.map((item: Json) => `${item.file} (${item.error})`).join(', ')}`));
    body.append(button('Güncellemeleri denetle', async () => {
      try { const result = await hafizeApi.platform<Json>('/api/skills/updates', 'POST', {}); toast(`Güncelleme denetimi: ${result.installed || 0} paket kuruldu.`); } catch { toast('Güncelleme kaynağı (HAFIZE_SKILL_FEED_URL) ayarlı değil veya erişilemedi.'); }
    }));
  }));

  panel.append(section('Yedekleme', 'Şifreli yedekler; klasöre (OneDrive/Drive eşitleme klasörü olabilir) veya WebDAV sunucusuna.', async (body) => {
    const data = await hafizeApi.platform<Json>('/api/backup');
    if (!data.configured) {
      body.append(el('p', 'platform-empty', 'Yedekleme kapalı. Açmak için .env dosyasına HAFIZE_BACKUP_DIR (veya HAFIZE_BACKUP_WEBDAV_URL) ve en az 8 karakterlik HAFIZE_BACKUP_PASSPHRASE ekleyip sunucuyu yeniden başlat.'));
      return;
    }
    body.append(el('p', 'platform-kpis', data.last ? `Son yedek: ${date(data.last.at)} · ${data.last.memories} not, ${data.last.images} görsel` : 'Bu oturumda henüz yedek alınmadı.'));
    body.append(table(['Yedek dosyası', ''], (data.snapshots || []).slice(-10).reverse().map((name: string) => [name, button('Geri yükle', async () => {
      if (!window.confirm(`${name} geri yüklensin mi? Daha yeni kayıtların üzerine yazılmaz.`)) return;
      const result = await hafizeApi.platform<Json>('/api/backup/restore', 'POST', { name });
      toast(`Geri yüklendi: ${result.memories} not, ${result.images} görsel.`);
    })])));
    body.append(button('Şimdi yedekle', async () => {
      try { const result = await hafizeApi.platform<Json>('/api/backup', 'POST', {}); toast(`Yedek alındı: ${result.name}`); } catch { toast('Yedek alınamadı.'); }
    }));
  }));
  return panel;
}

function mount(): boolean {
  const workspace = document.querySelector('#settingsWorkspace');
  if (!workspace) return false;
  if (!workspace.querySelector('#platformPanel')) workspace.append(buildPanel());
  return true;
}

if (!mount()) {
  const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
  observer.observe(document.body, { childList: true, subtree: true });
}
