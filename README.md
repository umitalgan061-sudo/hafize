# Hafize

Hafize, NVIDIA NIM destekli kişisel yapay zekâ çalışma alanıdır. Uygulama Claude-benzeri bir sohbet deneyimi, agent registry/delegation, tool-calling, context compaction, kişisel memory, scheduled tasks, Redis lease, PWA, ses özellikleri ve kullanıcı izinli GitHub / Google / Gmail / Canva bağlantıları için backend runtime içerir.

## Çalıştırma

Node.js ile:

```bash
npm install
cp .env.example .env
npm start
```

Geliştirme ortamında varsayılan `HOST=127.0.0.1` olduğunda kullanıcı oturumu zorunlu değildir. `NODE_ENV=production` veya public bir `HOST` kullanıldığında `HAFIZE_AUTH_TOKEN` ile oturum koruması otomatik etkinleşir. Public deployment'ta `npm start` kullanılmalıdır; bu komut production guard'ı yükler.

## Zorunlu üretim ayarları

`HAFIZE_AUTH_TOKEN` en az 32 karakterlik rastgele bir secret olmalıdır. `HAFIZE_COOKIE_SECURE=true` HTTPS altında kullanılmalıdır. Reverse proxy arkasında gerçek istemci IP'sine göre rate limit isteniyorsa `HAFIZE_TRUST_PROXY=true` yalnızca güvenilen proxy ortamında açılmalıdır.

Uygulama oturumları imzalı, HttpOnly ve SameSite=Strict cookie kullanır. State-changing API isteklerinde ek CSRF başlığı doğrulanır. Giriş denemeleri, genel API ve chat/agent çağrıları için bellek içi bounded rate limit ve chat concurrency limiti vardır. `HAFIZE_CONNECTOR_AUTH_TOKEN` connector runtime'ın `/api/agent/run` ve connector status uçları için kullanılan ayrı bir Bearer kimliğidir; uygulama oturumu yerine geçmez ve diğer protected endpoint'leri açmaz.

## Servisler

NVIDIA anahtarı server-side tutulur. GitHub okuma erişimi allowlist ile sınırlandırılır. Scheduled task API'si kullanıcı oturumundan ayrı olarak `HAFIZE_SCHEDULE_AUTH_TOKEN` ile korunur; böylece dış worker/cron çağrıları web oturum cookie'sine ihtiyaç duymaz.

## Sohbet çalışma alanı

Sidebar içindeki Conversation Workspace, yerel sohbet geçmişini toplu yönetmek için kullanılır. Mevcut tekli sabitleme/adlandırma/dışa aktarma yüzeylerinin yerine geçmez; onları tamamlar.

## Mesaj çalışma alanı

Mesaj Çalışma Alanı, mevcut sohbet içindeki tek tek mesajları yerel olarak kaydetme, geri bildirimleme, notlama, etiketleme, arama, filtreleme, sıralama ve seçerek JSON dışa aktarma yüzeyidir.

- Metadata sohbet metninden ayrı olarak `hafize.message-workspace.v1` anahtarında tutulur; sohbet yeniden kaydedildiğinde işaretler kaybolmaz.
- En fazla 240 kayıt tutulur; not 600, etiket 24 karakter ve mesaj başına 8 etiket ile sınırlıdır.
- Boş not, boş geri bildirim, boş etiket listesi ve kaydedilmemiş durum bir aradayken kayıt tamamen silinir.
- `Ctrl / ⌘ + Shift + B` panel aramasına odaklanır; düzenlenebilir alanlarda kısayol devre dışıdır.
- Dışa aktarma yalnızca seçilen kayıtları JSON olarak indirir; sunucuya veri gönderilmez.

Kontroller `node scripts/test-message-workspace-policy.mjs` ve `node scripts/test-message-workspace-adversarial.mjs` ile çalıştırılır. Ayrıntılar `docs/MESSAGE_WORKSPACE*.md` dosyalarındadır.

## İstem Kütüphanesi

İstem Kütüphanesi, tekrar kullanılan prompt'ları cihaz üzerinde saklayıp sohbet composer alanına aktaran yerel yardımcı araçtır.

Desteklenen akış:

- yeni prompt oluşturma, düzenleme ve silme,
- etiketleme ve favorileme,
- başlık/gövde/etiket/değişken araması,
- güncellenen, favoriler, yeni oluşturulan ve başlık sıralaması,
- `{{konu}}` benzeri değişkenleri kullanım sırasında doldurma,
- istem metnini panoya kopyalama veya yeni id ile çoğaltma,
- çoklu seçim, favorileme ve onaylı toplu silme,
- 1 MB sınırlandırılmış JSON import/export,
- 10 güvenli başlangıç istemi ve eksik starter'ları geri yükleme,
- `Ctrl / ⌘ + Shift + P` arama ve `Ctrl / ⌘ + Shift + N` yeni istem kısayolları.

`Kullan` yalnızca `#messageInput` değerini değiştirir; otomatik gönderim yapmaz. Prompt verisi `hafize.prompt-library.v1` altında tutulur ve conversation history ile paylaşılmaz. Ayrıntılar `docs/PROMPT_LIBRARY*.md` dosyalarındadır.

## Yanıt biçimlendirme

Asistan yanıtları `markdown-renderer.js` + `chat-markdown.js` ikilisiyle güvenli
markdown olarak çizilir. Renderer hiçbir zaman HTML metni ayrıştırmaz; her düğüm
`createElement` / `createTextNode` ile kurulur ve yalnızca `http:`, `https:` ve
`mailto:` adresleri bir `href` içine girebilir. Akış sırasında boyamalar tek bir
animasyon karesinde birleştirilir, düğüm `aria-busy` ile işaretlenir ve yanıt
tamamlandığında bekleyen kare iptal edilir. Kullanıcı mesajları düz metin olarak
kalır. Ayrıntılar `docs/CHAT_MARKDOWN*.md` dosyalarındadır.

## Akıllı doldurma

Değişken içeren bir istemde `Kullan`, doğrudan aktarım yerine Akıllı doldurma panelini açar. Panel her `{{değişken}}` için bir alan üretir, önizlemeyi yazdıkça günceller ve yalnızca tüm alanlar dolduğunda composer'a aktarır.

- Alan başına 1000, istem başına 12 değişken ve 8000 karakter önizleme sınırı vardır.
- Sık kullanılan değer kümeleri istem başına en fazla 6 "değişken seti" olarak cihazda saklanır; anahtar `hafize.prompt-library.smart-fill.v1.<istem-id>` biçimindedir.
- Panel `role="dialog"` ile açılır, Tab odağını içeride tutar, `Escape` ile kapanır ve odağı paneli açan düğmeye geri verir.
- Aktarım composer'ı doldurur, submit etmez ve istemin kullanım sayacını (`useCount`) artırır.
- `/prompt` komut paleti aynı istemleri composer içinden arayıp seçmeyi sağlar.

Değişken değerleri ve setleri yalnızca cihazda tutulur; sunucuya gönderilmez. Ayrıntılar `docs/PROMPT_SMART_FILL*.md` dosyalarındadır.

## Toplu düzenleme

İstem kartındaki `Toplu düzenle`, seçili istemlerin etiketlerini ve favori
durumunu tek seferde değiştirir. Etiket ekleme, değiştirme ve çıkarma ayrı
işlemlerdir; en fazla 40 istem seçilir, istem başına 8 etiket ve etiket başına 24
karakter tutulur. Panel `role="dialog"` ile açılır ve `Escape` ile kapanır.
Yazma, kütüphanenin kendi `saveItems` yazıcısı üzerinden yapılır.

## İstem içe aktarma önizlemesi

`İçe aktar`, seçilen yedeği doğrudan yazmak yerine önce ne olacağını gösterir:
kaç istem yeni, kaçı kopya olarak eklenecek, kaçı sınır nedeniyle atlanacak ve
kaçı okunamıyor. Onaylanana kadar hiçbir şey yazılmaz; onay sonrası yazma
kütüphanenin kendi `saveItems` yazıcısı üzerinden yapılır. Dosya sınırı 1 MB'dır
ve veri cihazdan ayrılmaz. Ayrıntılar `docs/PROMPT_LIBRARY_IMPORT_PREVIEW.md`
dosyasındadır.

## İstem sağlık kontrolü

İstem kartındaki sağlık kontrolü paneli üç yerel depoyu (istemler, koleksiyonlar,
sürüm geçmişi) okur ve okunamayan kayıtları, çakışan kimlikleri, silinmiş
istemlere işaret eden koleksiyon üyeliklerini ve depo baskısını raporlar. Onarım
yalnızca açık onayla çalışır ve yazma işlemleri ilgili modülün kendi yazıcısı
üzerinden yapılır. Ayrıntılar `docs/PROMPT_LIBRARY_DIAGNOSTICS.md` dosyasındadır.

## Zamanlanmış Görevler

Görevler çalışma alanı, mevcut schedule HTTP API üzerinden authenticated kullanıcıya tek seferlik görev planlama, listeleme ve iptal etme yüzeyi sağlar.

- `/api/schedules` GET/POST ve `/api/schedules/:id` DELETE kullanılır.
- Ajan, task metni, gelecek tarih/saat ve 1–5 maksimum deneme seçilebilir.
- Günlük özet, satış özeti, kod incelemesi, araştırma özeti, haftalık plan ve kontrol listesi hızlı şablonları vardır.
- Durum filtreleri Planlandı, Çalışıyor, Tamamlandı, Başarısız ve İptal edildi olarak ayrılır.
- Planlanan görevlerde kalan süre göstergesi bulunur ve panel açıkken liste periyodik yenilenir.
- `Ctrl / ⌘ + Shift + T` ile görevler paneli açılır; düzenlenebilir alanlarda kısayol devre dışıdır.
- Görev içeriği browser storage'a otomatik kopyalanmaz ve schedule API response'ları service worker cache'lenmez.
- Server authentication, ownership, credential policy ve state transitions değiştirilmez; UI bunları yeniden uygulamaya çalışmaz.
- Ayrıntılar `docs/SCHEDULED_TASKS_*.md` dosyalarındadır.

## Test

```bash
npm run precheck
npm run check
npm run check:modern
```

`npm run check` tüm node tabanlı sözleşme/duman paketlerini, `npm run check:modern`
ise TypeScript tip kontrolünü, Vitest paketlerini, biçim kontrolünü ve modern
araç zinciri sözleşmelerini çalıştırır. Tarayıcı tarafındaki TypeScript modülleri
`npm run build` ile `public/typed-build/` altına derlenir; bu dizin üretilen bir
çıktıdır ve repoya commit edilmez (`npm start` öncesinde `prestart` derlemeyi
kendisi yapar).

İstem kütüphanesi ek kontrolleri:

```bash
node scripts/test-prompt-library-import-preview.mjs
node scripts/test-prompt-library-import-preview-behavior.mjs
node scripts/test-prompt-library-diagnostics.mjs
node scripts/test-prompt-library-diagnostics-behavior.mjs
node scripts/test-prompt-library-bulk-organizer.mjs
```

Scheduled Tasks özel kontrolleri:

```bash
node scripts/test-scheduled-tasks-contract.mjs
node scripts/test-scheduled-tasks-source.mjs
node scripts/test-scheduled-tasks-security.mjs
node scripts/test-scheduled-tasks-time-and-errors.mjs
node scripts/test-scheduled-tasks-ui.mjs
node scripts/test-scheduled-tasks-keyboard.mjs
node scripts/test-scheduled-tasks-countdown.mjs
node scripts/test-scheduled-tasks-pwa.mjs
node scripts/test-scheduled-tasks-index-and-sw.mjs
node scripts/test-scheduled-tasks-regression.mjs
```

Conversation Workspace özel kontrolleri:

```bash
node scripts/test-conversation-workspace.mjs
node scripts/test-conversation-workspace-adversarial.mjs
node scripts/test-conversation-workspace-data-compat.mjs
node scripts/test-conversation-workspace-keyboard.mjs
```

Mesaj Workspace özel kontrolleri:

```bash
node scripts/test-message-workspace-policy.mjs
node scripts/test-message-workspace-source.mjs
node scripts/test-message-workspace-adversarial.mjs
node scripts/test-message-workspace-compatibility.mjs
node scripts/test-message-workspace-keyboard.mjs
node scripts/test-message-workspace-runtime.mjs
node scripts/test-message-workspace-export.mjs
node scripts/test-message-workspace-regression.mjs
```

Production hardening için ayrıca:

```bash
node scripts/test-production-hardening.mjs
```

## Güvenlik

Secret, token, `.env`, runtime data ve şifreli dosyalar repoya eklenmemelidir. GitHub/Gmail/Canva gibi dış servislerde yazma veya silme işlemleri açık kullanıcı onayı ve dar yetki politikalarıyla çalışmalıdır. Self-development değişiklikleri branch + Pull Request akışıyla yapılmalıdır; repository'nin ayrıntılı kuralları için `HAFIZE_RULES.md` dosyasına bakın.

## Mimari not

`server.mjs` uygulamanın HTTP/API runtime'ıdır. `lib/production-guard.mjs` public çalıştırma giriş noktasına preloaded olarak kimlik doğrulama, CSRF ve rate limit sınırlarını ekler. Tarayıcı tarafındaki `public/auth.js` yalnızca oturum akışını yönetir; erişim anahtarını kalıcı olarak saklamaz.
