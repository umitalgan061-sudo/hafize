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

Kısayollar:

```text
Ctrl / ⌘ + Shift + A   Görünen sohbetleri seç
Ctrl / ⌘ + Shift + X   Seçimi temizle
Ctrl / ⌘ + Shift + U   Workspace aramasına geç
Esc                    Workspace aramasını temizle
```

Ayrıntılı sözleşme için `docs/CONVERSATION_WORKSPACE.md`, operasyon için `docs/CONVERSATION_WORKSPACE_RUNBOOK.md`, güvenlik incelemesi için `docs/CONVERSATION_WORKSPACE_SECURITY.md` kullanılmalıdır.

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

Production hardening için ayrıca:

```bash
node scripts/test-production-hardening.mjs
```

## Güvenlik

Secret, token, `.env`, runtime data ve şifreli dosyalar repoya eklenmemelidir. GitHub/Gmail/Canva gibi dış servislerde yazma veya silme işlemleri açık kullanıcı onayı ve dar yetki politikalarıyla çalışmalıdır. Self-development değişiklikleri branch + Pull Request akışıyla yapılmalıdır; repository'nin ayrıntılı kuralları için `HAFIZE_RULES.md` dosyasına bakın.

## Mimari not

`server.mjs` uygulamanın HTTP/API runtime'ıdır. `lib/production-guard.mjs` public çalıştırma giriş noktasına preloaded olarak kimlik doğrulama, CSRF ve rate limit sınırlarını ekler. Tarayıcı tarafındaki `public/auth.js` yalnızca oturum akışını yönetir; erişim anahtarını kalıcı olarak saklamaz.
