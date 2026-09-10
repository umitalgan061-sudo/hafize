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

Desteklenen işlemler:

- başlık, etiket, mesaj ve ajan kimliğine göre yerel arama,
- aktif/arşivlenmiş/sabitlenmiş/etiketli filtreleri,
- güncelleme, oluşturulma ve başlığa göre sıralama,
- görünür sohbetleri topluca seçme ve seçim temizleme,
- arşivleme ve arşivden çıkarma,
- sabitleme ve sabitlemeyi kaldırma,
- seçilen sohbetleri kopyalama,
- seçilen sohbetlere kullanıcı girişiyle etiket ekleme,
- seçilen sohbetleri JSON olarak dışa aktarma,
- JSON yedeklerini bounded normalization ile içe aktarma,
- yerel history için 30 kayıtlık quota görünümü.

Workspace yalnızca `localStorage` kullanır. Import/export için backend endpoint'i veya uzak dosya yükleme çağrısı eklenmez. Import sırasında id çakışması mevcut kaydın üzerine yazmak yerine yeni import id'si üretir.

## Mesaj çalışma alanı

Mesaj Çalışma Alanı, mevcut sohbet içindeki tek tek mesajları uzun vadeli kişisel işaretlere dönüştürür. Kullanıcı veya Hafize mesajı kaydedilebilir; asistan yanıtına olumlu/olumsuz geri bildirim, kısa not ve etiket eklenebilir.

Panel sağdaki yardımcı araçlar bölümünde açılır. Kayıtlı mesajlar mesaj metni, not ve etiket üzerinde aranabilir; kaydedilen, geri bildirimli, notlu, kullanıcı, Hafize ve etiketli görünümler arasında filtrelenebilir. Son güncellenen, eski, etkileşimli ve notlu sıralamalar mevcuttur.

Seçili mesaj kayıtları JSON olarak dışa aktarılabilir. Export yerel Blob üzerinden yapılır; backend'e yeni endpoint eklenmez ve sohbet geçmişi ayrı storage anahtarında tutulduğu için `app.js`'nin sohbet kaydetmesi metadata'yı ezmez.

Veri anahtarı `hafize.message-workspace.v1`, görünüm durumu ise aynı anahtarın `.state` uzantısıdır. Kayıtlar 240, seçim ve export 100, not 600, etiket 24 karakter ve 8 adetle sınırlandırılır.

Kısayollar:

```text
Ctrl / ⌘ + Shift + B   Mesaj çalışma alanı aramasına geç
Ctrl / ⌘ + Shift + K   Görünen mesaj kayıtlarını seç
Ctrl / ⌘ + Shift + X   Mesaj seçimini temizle
```

Metadata katmanı `/api/` çağırmaz; `fetch`, `XMLHttpRequest`, `WebSocket`, cookie veya Authorization erişimi yoktur. Yeni asset'ler PWA shell cache'ine eklenmiştir.

Ayrıntılı sözleşme için `docs/MESSAGE_WORKSPACE.md`, güvenlik için `docs/MESSAGE_WORKSPACE_SECURITY.md`, operasyon için `docs/MESSAGE_WORKSPACE_RUNBOOK.md` kullanılmalıdır.

## Test

```bash
npm run precheck
npm run check
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
