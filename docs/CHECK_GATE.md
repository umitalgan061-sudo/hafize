# Check gate — `npm run check`

Bu belge Hafize'nin statik/smoke doğrulama kapısını tanımlar.

## Neden değişti

Kapı daha önce `package.json` içinde tek satırlık dev bir `&&` zinciriydi. Bu yapının iki somut sorunu vardı:

1. **İlk hatada duruyordu.** `scripts/test-tool-runtime.mjs` başarısız olduğu için zincirin geri kalanı hiç çalışmıyordu; arkasında ikinci bir gerçek hata (`scripts/test-gmail-read-client.mjs`) gizli kaldı.
2. **Sürükleniyordu.** Her yeni test dosyasının zincire elle eklenmesi gerekiyordu. Eklenmeyen ~25 test dosyası kapının dışında kalmıştı.

## Nasıl çalışır

`scripts/run-checks.mjs` hedefleri elle listelemek yerine keşfeder:

- **Sözdizimi kontrolü:** `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` için `node --check`.
- **Kayıt doğrulama:** `scripts/validate-agent-registry.mjs`.
- **Testler:** `scripts/test-*.mjs` dosyalarının tamamı.

Davranış kuralları:

- Her aşama **tüm** hedefleri çalıştırır; ilk başarısızlıkta durmaz.
- Başarısız her hedef ad + yakalanan çıktı ile raporlanır; hiçbir hata sessizce yutulmaz.
- Her alt süreç ayrı çalışır ve varsayılan **120 sn** zaman aşımına tabidir; takılan bir test kapıyı süresiz bloklayamaz.
- Alt süreçler sınırlı eşzamanlılıkla (en fazla 8) yürütülür.
- Herhangi bir aşama kırmızıysa çıkış kodu `1`'dir.

`npm run check` ve `npm test` aynı kapıyı çalıştırır. Eski `precheck` betiği kaldırıldı; kapsadığı dosyaların tamamı (voice-input, voice-output, ui-shell, sidebar-accessibility) keşif yoluyla zaten kapıda olduğu için aynı işi yapan ikinci bir sistem tutulmadı.

## Test edilebilirlik

`scripts/run-checks.mjs` saf yardımcıları (`discoverSyntaxTargets`, `discoverTestScripts`, `selectTestScripts`, `summarize`, `exitCodeFor`, `runChecks`) dışa aktarır ve yalnız doğrudan çalıştırıldığında `process.exit` çağırır. `scripts/test-run-checks.mjs` geçici bir fixture deposu kurarak şunları doğrular: bir testin başarısız olması diğerlerini gizlemez, bozuk sözdizimi yakalanır, takılan test zaman aşımıyla kırmızıya döner ve çıkış kodu doğru hesaplanır.

## Yeni test eklerken

Yeni dosyayı `scripts/test-<konu>.mjs` adıyla oluşturmak yeterlidir; kapı onu otomatik bulur. `package.json` düzenlenmez.

## Geri alma

`package.json` içindeki `check`/`test` betiklerini eski `&&` zincirine döndürmek ve `scripts/run-checks.mjs` ile `scripts/test-run-checks.mjs` dosyalarını silmek yeterlidir; başka modül bu dosyalara bağımlı değildir.
