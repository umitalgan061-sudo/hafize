# Check Gate — keşif tabanlı statik ve smoke test kapısı

`npm run check` tek bir çalıştırıcıya delege eder: `scripts/run-checks.mjs`.

## Neden

Kapı daha önce `package.json` içinde elle bakılan uzun bir `&&` zinciriydi. Yeni bir
modül veya test dosyası eklendiğinde zincire yazılmadığı sürece sessizce kapı dışında
kalıyordu. Bu yüzden depoda **33 test dosyası hiç çalıştırılmıyordu** ve iki gerçek
hata fark edilmeden kaldı:

- `scripts/test-tool-runtime.mjs` araç kataloğunu 3 araç olarak bekliyordu; `canva_read`
  ve `gmail_read` eklendikten sonra kapı kırmızıydı.
- `lib/gmail-read-client.mjs` ve `lib/canva-read-client.mjs` `read(null)` çağrısında
  doğrulama hatası yerine `TypeError` fırlatıyordu.

## Nasıl çalışır

`scripts/run-checks.mjs` hedeflerini dosya sisteminden keşfeder:

- **Syntax:** `server.mjs` ile `lib/`, `public/` ve `scripts/` altındaki tüm `.mjs`/`.js`
  dosyaları için `node --check`.
- **Doğrulayıcılar:** `scripts/validate-*.mjs`.
- **Testler:** `scripts/test-*.mjs` (alfabetik, ayrı süreçlerde, 120 sn zaman aşımı).

Her hedef ayrı bir child process'te çalışır; başarılı çıktı sessizdir, başarısız
kontrollerin tam çıktısı özetin üstünde toplu olarak raporlanır. Çıkış kodu, herhangi
bir kontrol başarısızsa `1` olur.

Kullanım:

```bash
npm run check                       # tüm kapı
node scripts/run-checks.mjs --filter schedule   # yalnızca eşleşen hedefler
node scripts/run-checks.mjs --list              # çalıştırmadan planı yazdırır
```

## Kapı dışında kalma

`EXCLUDED_TESTS` sözlüğü kapı dışında bırakılan test dosyalarını **açık gerekçesiyle**
tutar ve şu anda boştur. `scripts/test-check-gate.mjs` şunları doğrular:

- her `lib/*.mjs`, `public/*.js`, `scripts/*.mjs` dosyası syntax kapısında;
- her `scripts/test-*.mjs` dosyası ya çalıştırılıyor ya da gerekçeli bir istisna;
- `package.json` içindeki `check` komutu çalıştırıcıya delege ediyor ve elle bakılan
  zincir geri gelmemiş.

Ortam gerektiren testler kendi içlerinde atlanır; örneğin
`scripts/test-redis-schedule-lease-live.mjs` `HAFIZE_TEST_REDIS_URL` tanımlı değilse
başarılı biçimde atlar. Bu yaklaşım, ortam bağımlı testlerin kapı listesinden
çıkarılmasına gerek bırakmaz.

## Geri alma

`package.json` içindeki `check` komutunu eski zincirle değiştirmek ve
`scripts/run-checks.mjs` ile `scripts/test-check-gate.mjs` dosyalarını silmek yeterlidir;
diğer düzeltmeler bağımsızdır.
