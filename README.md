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

## GitHub çalışma alanı

GitHub çalışma alanı, sunucu tarafındaki allowlist ile izin verilen repository'leri Hafize içinden salt-okunur incelemek için kullanılır.

- Repository özeti, varsayılan branch, branch listesi, commit geçmişi ve PR listesi okunabilir.
- Dosya görünümü güvenli path normalizasyonu, hassas dosya engeli ve plaintext credential kontrolünü mevcut GitHub read policy ile birlikte uygular.
- Tarayıcı GitHub token'ı görmez; istekler same-origin /api/github/workspace endpoint'ine gider ve endpoint production oturum koruması arkasındadır.
- UI yalnızca GET kullanır; branch oluşturma, commit, PR açma/merge etme ve silme işlemleri bu yüzeyde bulunmaz.
- Son repository/ref/path durumu sadece sessionStorage içinde tutulur; token veya GitHub yanıtı kalıcı browser storage'a yazılmaz.
- Ctrl / ⌘ + Shift + G repository alanına odaklanır.

GitHub çalışma alanı özel kontrolü:

```bash
node scripts/test-github-workspace-api.mjs
node scripts/test-github-workspace-security.mjs
node scripts/test-github-workspace-ui.mjs
node scripts/test-github-workspace-contract.mjs
```

Ayrıntılar docs/GITHUB_WORKSPACE*.md dosyalarındadır.

GitHub çalışma alanı ayrıca dizin listeleme, iki ref arasında salt-okunur karşılaştırma ve seçilen commit veya PR için ayrıntı okuma araçları sağlar. Hızlı işlemler son repository seçimini oturum içinde hatırlar, görünür sonucu kopyalamaya ve PR durumunu değiştirmeden filtrelemeye izin verir.

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

`npm run check` artık `node --check` syntax taramasının yanında iki TypeScript
projesini de derler (`tsconfig.json` ve `tsconfig.runtime.json`). Bunun nedeni
`node --check`'in ESM olarak algılanan bir `.ts` dosyasını ayrıştırmadan sessizce
başarılı saymasıdır; bu boşluk yüzünden bozuk bir `vite.config.ts` kontrol
kapısından geçip üretim derlemesini kırabiliyordu. Hızlı geri bildirim için
`npm run precheck` bu aşamayı `--skip-typescript` ile atlar.

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

### TypeScript migration release gates

Modern kontroller typed runtime ve browser girişlerini ayrıca doğrular:

```bash
node scripts/test-typescript-entrypoints-release.mjs
node scripts/test-typescript-security-entrypoints.mjs
```

Bu gate'ler production entry'nin `server.ts` olduğunu, typed browser artifact'larının Vite üzerinden geldiğini, legacy browser girişlerinin HTML'den çıkarıldığını ve güvenlik çekirdeğinin TS kaynaklarını doğrular.

## TypeScript modernizasyonu

Hafize'nin üretim runtime'ı TypeScript tabanına geçirilirken browser tarafındaki büyük çalışma alanları da Vite üzerinden derlenen typed entrypoint'lere taşınıyor. Bu migration dalgasında Markdown Renderer ve Conversation Workspace kaynakları `public/*.ts`, Message Workspace, Prompt Library ve Scheduled Tasks kaynakları `public/typed/*.ts` altında tutuluyor; HTML üretimde `typed-build/*.js` çıktısını yüklüyor.

Toolchain TypeScript 7.0.2, Vite 8.3.0 ve Vitest 5.0.1 ile pinlenmiştir. Node.js 24.21+ LTS üretim tabanıdır. Legacy `.js` dosyaları yalnızca geriye dönük uyumluluk köprüsü olarak kalır ve yeni uygulama mantığı içermez. Migration sözleşmeleri `scripts/test-typescript-ui-wave.mjs`, `scripts/test-typescript-entrypoints-release.mjs` ve `scripts/test-legacy-entry-contract.mjs` ile korunur.

## Güvenlik

Secret, token, `.env`, runtime data ve şifreli dosyalar repoya eklenmemelidir. GitHub/Gmail/Canva gibi dış servislerde yazma veya silme işlemleri açık kullanıcı onayı ve dar yetki politikalarıyla çalışmalıdır. Self-development değişiklikleri branch + Pull Request akışıyla yapılmalıdır; repository'nin ayrıntılı kuralları için `HAFIZE_RULES.md` dosyasına bakın.

## Mimari not

`server.ts` uygulamanın HTTP/API runtime'ıdır. `lib/production-guard.ts` public çalıştırma giriş noktasına preloaded olarak kimlik doğrulama, CSRF ve rate limit sınırlarını ekler. Tarayıcı tarafında `public/typed/*.ts` kaynakları Vite ile derlenir; erişim anahtarları server-side kalır.
## TypeScript runtime migration

Server çekirdeğinin güvenlik, agent, tool, model ve schedule sınırları TypeScript 7 strict mode ile çalışır. Node.js 24.21.0+ production hedefidir; Vite 8.3 ve Vitest 5 build/test zincirinin parçasıdır. Kalan .mjs modülleri güvenli kademeli migration için yaprak bağımlılık olarak korunur. Ayrıntılar: docs/TYPESCRIPT_MIGRATION.md, docs/TYPESCRIPT_ARCHITECTURE.md ve docs/TYPESCRIPT_TEST_MATRIX.md.

## İçe aktarma güvenliği ve kütüphane sağlığı

Prompt Library içe aktarma akışı dosyayı yazmadan önce güvenli bir önizleme üretir. Kayıt sayısı, geçersiz kayıtlar, ID çakışmaları ve kapasite etkisi kullanıcıya gösterilir; açık onay olmadan storage değiştirilmez.

- JSON dosyaları en fazla 1 MB olabilir; mevcut kütüphane en fazla 120 istem tutar.
- Çakışan prompt ID'leri mevcut kaydın üzerine yazılmaz; yeni bir ID ile korunur.
- Kütüphane Sağlığı paneli bozuk kayıtları, yinelenen ID'leri, geçersiz kullanım sayaçlarını ve koleksiyon/revizyon yetimlerini raporlar.
- Güvenli onarım yalnızca kullanıcı onayıyla çalışır. Yinelenen kayıtlar yeni ID ile korunur; yetim ilişkiler geçerli prompt ID'lerine göre sınırlandırılır.
- Geçersiz kayıtları kaldırma işlemi kalıcı silme yerine cihaz üzerindeki karantinaya taşır; Karantinayı geri al ile tekrar denenebilir.
- Yedek indir eylemi prompt, collection ve revision verilerini tek recovery JSON dosyasında dışa aktarır; sunucuya gönderilmez.
- Import/diagnostics katmanları fetch, XHR, WebSocket veya telemetry kullanmaz.

Ayrıntılar docs/PROMPT_LIBRARY_IMPORT_*.md ve docs/PROMPT_LIBRARY_DIAGNOSTICS_*.md dosyalarındadır.

### Import ve diagnostics kontrolleri

node scripts/test-prompt-library-safety-final-gate.mjs
node scripts/test-prompt-library-import-preview.mjs
node scripts/test-prompt-library-import-pwa.mjs
node scripts/test-prompt-library-diagnostics.mjs
node scripts/test-prompt-library-repair-checkpoint.mjs
node scripts/test-prompt-library-quarantine.mjs

İçe aktarma önizlemesi normal JSON yedeklerinin yanında recovery snapshot içindeki prompts alanını da tanır. Diagnostics paneli repair öncesi etki özeti gösterir; güvenli repair checkpoint üretir, geçersiz kayıtları karantinaya taşıyabilir ve son repair'i geri alabilir. Rapor ve repair planı prompt metinlerini içermeyen özet biçimde panoya kopyalanabilir.

## Tarayıcı girişlerinin test edilebilirliği

`public/typed/ui-shell.ts`, `public/typed/voice-input.ts` ve
`public/typed/voice-output.ts` otomatik kurulumlarını `globalThis.document`
varlığına bağlar. Modüller bu sayede Node altında yan etkisiz olarak içe
aktarılabilir ve davranış testleri derlenmiş çıktıya değil doğrudan TypeScript
kaynağına karşı çalışır:

```bash
node scripts/test-ui-shell.mjs
node scripts/test-sidebar-accessibility.mjs
node scripts/test-voice-input.mjs
node scripts/test-voice-output.mjs
```

Platform bağımlılıkları (`SpeechRecognition`, `speechSynthesis`,
`MutationObserver`, `setTimeout`, `localStorage`, `matchMedia`) global olarak
okunmaz; `installVoiceInput(documentRef, root)` gibi kurulum fonksiyonlarına
parametre olarak verilir. Testler yapay bir `root` nesnesi geçirerek gerçek
davranışı doğrular.

## PWA kabuk önbelleği sözleşmesi

Service worker `cache.addAll(SHELL_ASSETS)` kullanır; bu çağrı tek bir 404'te
bütünüyle reddedilir ve çevrimdışı kabuğu tamamen devre dışı bırakır. Bu yüzden
`public/sw-policy.js` içindeki her varlık diskte bulunmak, `index.html` tarafından
yüklenen her varlık da listede yer almak zorundadır. Sözleşme
`scripts/shell-cache-contract.mjs` üzerinden iki yönlü doğrulanır; bir yükleyici
betiğin çalışma zamanında enjekte ettiği dosyalar (`inject('/x.js', …)`) da
erişilebilir sayılır.

Özellik kapıları kabuk önbelleğinin **sürümlendiğini** doğrular, belirli bir
sürüm numarasını değil. Sabitlenen sürüm bir sonraki bump'ta o kapıyı kırıyordu
ve tek bir kaynak aynı anda `v36` ile `v38` olamayacağı için kapılar birbirini
dışlıyordu.
