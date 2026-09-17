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

## Akıllı doldurma

Değişken içeren bir istemde `Kullan`, doğrudan aktarım yerine Akıllı doldurma panelini açar. Panel her `{{değişken}}` için bir alan üretir, önizlemeyi yazdıkça günceller ve yalnızca tüm alanlar dolduğunda composer'a aktarır.

- Alan başına 1000, istem başına 12 değişken ve 8000 karakter önizleme sınırı vardır.
- Sık kullanılan değer kümeleri istem başına en fazla 6 "değişken seti" olarak cihazda saklanır; anahtar `hafize.prompt-library.smart-fill.v1.<istem-id>` biçimindedir.
- Panel `role="dialog"` ile açılır, Tab odağını içeride tutar, `Escape` ile kapanır ve odağı paneli açan düğmeye geri verir.
- Aktarım composer'ı doldurur, submit etmez ve istemin kullanım sayacını (`useCount`) artırır.
- `/prompt` komut paleti aynı istemleri composer içinden arayıp seçmeyi sağlar.

Değişken değerleri ve setleri yalnızca cihazda tutulur; sunucuya gönderilmez. Ayrıntılar `docs/PROMPT_SMART_FILL*.md` dosyalarındadır.

## Kütüphane Kalite Merkezi

Kütüphane Kalite Merkezi, Prompt Library, koleksiyonlar ve revizyonlar için cihaz üzerinde sağlık ve bakım taraması yapar.

- bozuk JSON/kayıt, yinelenen id, tekrar eden veya birbirine çok benzeyen prompt'lar,
- eksik etiket, uzun gövde, kullanılmayan/eski prompt ve değişken sınırı sorunları,
- koleksiyonlarda yetim üyeler ve duplicate id durumları,
- revizyonlarda bozuk veya yetim ilişkiler,
- hata / uyarı / bilgi filtreleri, yeniden tarama ve kullanıcı onaylı güvenli onarım.

Sağlık raporu yerelde üretilir. `Raporu kopyala` teşhis özetini panoya aktarır; health enhancement etkin olduğunda `Raporu indir` ve `Sorunlu promptları indir` bounded JSON dosyaları oluşturur. Prompt gövdeleri teşhis raporuna varsayılan olarak eklenmez.

Health state yalnızca `hafize.prompt-library.health.v1` altında panel görünürlüğü ve severity filtresini saklar. Sağlık taraması fetch/XHR/WebSocket veya analytics/telemetry kullanmaz. Onarım confirmation gerektirir ve mevcut Prompt Library normalizer'ı üzerinden çalışır.

Panel mobil ve forced-colors görünümlerini destekler, issue listesi bounded tutulur ve PWA shell cache v38 health asset'lerini içerir. Ayrıntılar `docs/PROMPT_LIBRARY_HEALTH*.md` dosyalarındadır.

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
```

Health Center özel kontrolleri:

```bash
node scripts/test-prompt-library-health-core.mjs
node scripts/test-prompt-library-health-limits.mjs
node scripts/test-prompt-library-health-storage.mjs
node scripts/test-prompt-library-health-security.mjs
node scripts/test-prompt-library-health-dom.mjs
node scripts/test-prompt-library-health-accessibility.mjs
node scripts/test-prompt-library-health-pwa.mjs
node scripts/test-prompt-library-health-repair.mjs
node scripts/test-prompt-library-health-collections.mjs
node scripts/test-prompt-library-health-revisions.mjs
node scripts/test-prompt-library-health-stale.mjs
node scripts/test-prompt-library-health-state.mjs
node scripts/test-prompt-library-health-runtime.mjs
node scripts/test-prompt-library-health-enhancements.mjs
node scripts/test-prompt-library-health-export.mjs
node scripts/test-prompt-library-health-integration.mjs
node scripts/test-prompt-library-health-release.mjs
node scripts/test-prompt-library-health-algorithms.mjs
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
