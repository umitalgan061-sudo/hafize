# Doğrulama kapısı (check gate)

`npm run check` Hafize'nin tek doğrulama kapısıdır ve artık elle tutulan bir komut zinciri değil, depoyu tarayan bir çalıştırıcıdır.

- Çalıştırıcı sözleşmesi: `lib/check-runner.mjs`
- CLI: `scripts/run-checks.mjs`
- Testi: `scripts/test-check-runner.mjs`

## Neden değişti?

Kapı önceden `package.json` içinde tek satırlık dev bir `&&` zinciriydi. Bu yapının iki somut sorunu vardı:

1. **Sessiz kapsam kaybı.** Yeni bir `scripts/test-*.mjs` eklendiğinde zincire elle yazılmadığı sürece hiç çalışmıyordu. Kapı 87 testin yalnızca bir bölümünü yürütüyordu; `test-canva-read-client.mjs`, `test-gmail-read-client.mjs`, `test-oauth-*`, `test-personal-memory-*`, `test-device-bridge-policy.mjs` gibi güvenlik sınırı testleri kapı dışındaydı.
2. **Kırmızı kapı.** İlk başarısızlıkta zincir durduğu için geri kalan her kontrol atlanıyordu ve kapı uzun süredir kırmızıydı.

## Yeni davranış

- `lib/`, `scripts/` (`.mjs`), `public/` (`.js`) ve `server.mjs` için `node --check` sözdizimi kontrolü otomatik keşfedilir.
- `scripts/test-*.mjs` dosyalarının tamamı ve `scripts/validate-agent-registry.mjs` ayrı birer alt süreçte çalıştırılır.
- Kapı ilk hatada durmaz: tüm kontroller yürütülür, başarısız olanların çıktısı sonda toplu gösterilir ve süreç `exit 1` ile biter.
- Filtre desteği vardır: `node scripts/run-checks.mjs --filter=voice,ui-shell`. `npm run precheck` bu filtreyle yalnız arayüz/ses testlerini çalıştırır.
- Her test 120 sn zaman aşımına tabidir; takılan bir test kapıyı süresiz bekletmez.
- Harici servis gerektiren testler (örn. `test-redis-schedule-lease-live.mjs`) ortam değişkeni yoksa kendi içinde atlanır; kapıda ayrı bir dışlama listesi tutulmaz.

## Kapının açığa çıkardığı gerçek hatalar

Kapı yeşile alınırken iki gerçek hata bulundu ve düzeltildi:

- `scripts/test-tool-runtime.mjs` tool kataloğunu eski hâliyle bekliyordu; `canva_read` ve `gmail_read` araçları eklendiğinde bu test kırılmıştı ve zincirin geri kalanını da bloke ediyordu.
- `lib/gmail-read-client.mjs` ve `lib/canva-read-client.mjs` içindeki `read()` çağrısı `null` argümanla `TypeError` fırlatıyordu. Sınır girişleri artık fail-closed: `null`, dizi, string ve tanımsız alan içeren istekler `INVALID_GMAIL_READ:request` / `INVALID_CANVA_READ:request` ile reddedilir.

## Yeni test eklerken

Dosyayı `scripts/test-<konu>.mjs` adıyla oluşturmak yeterlidir; `package.json` düzenlenmez. Test başarısız olduğunda `process.exit` kodu sıfırdan farklı olmalıdır (`node:assert/strict` bunu doğal olarak sağlar).
