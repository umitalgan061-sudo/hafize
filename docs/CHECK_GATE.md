# Doğrulama kapısı (`npm run check`)

## Amaç

Her self-development turu, değişikliği birleştirmeden önce statik/syntax/smoke
testlerini çalıştırmak zorundadır. Bu kapı, o zorunluluğun tek giriş noktasıdır.

## Nasıl çalışır

`npm run check` → `node scripts/run-checks.mjs`.

Koşucu, listeyi elle tutmak yerine diskten keşfeder:

1. **Sözdizimi denetimi** — `server.mjs`, `lib/*.mjs`, `public/*.js` ve
   `scripts/*.mjs` dosyalarının tümü `node --check` ile denetlenir.
2. **Betik çalıştırma** — `scripts/validate-agent-registry.mjs` ve tüm
   `scripts/test-*.mjs` dosyaları ayrı süreçlerde sırayla çalıştırılır.

Her adım `ok` / `FAIL` olarak raporlanır. Bir adım başarısız olursa koşucu
kalan adımları yine de çalıştırır, sonunda başarısız adımların tam çıktısını
yazar ve `1` ile çıkar. Böylece tek bir kırık test, arkasındaki testleri
maskelemez.

`npm run precheck` sesli giriş/çıkış ve sohbet kabuğu için hızlı bir alt küme
olarak korunur; `check` bu testleri de kapsar.

## Neden keşif tabanlı

Kapı daha önce `package.json` içinde elle yazılmış uzun bir `&&` zinciriydi.
Yeni test dosyaları zincire eklenmediği için 32 test betiği hiç çalışmıyordu ve
zincir ilk hatada durduğu için sonraki hatalar görünmüyordu. Keşif tabanlı
koşucu bu kayma sınıfını tamamen ortadan kaldırır: `scripts/` altına eklenen
her `test-*.mjs` bir sonraki koşuda otomatik olarak kapıya dâhil olur.

## Kapının kendi testi

`scripts/test-check-gate.mjs`, `discoverCheckTargets()` çıktısını diskteki
dosyalarla karşılaştırır ve şunları doğrular:

- `package.json` içindeki `check` betiği koşucuya delege eder (elle tutulan
  zincire geri dönülmemiştir),
- diskteki her `scripts/test-*.mjs` çalıştırılacak kümededir,
- `server.mjs` ve her `lib/*.mjs` sözdizimi denetimindedir,
- koşucu kendini çalıştırmaz ve içe aktarıldığında yan etki üretmez.

## Canlı bağımlılığı olan testler

`scripts/test-redis-schedule-lease-live.mjs` yalnızca
`HAFIZE_TEST_REDIS_URL` tanımlıysa çalışır; tanımlı değilse kendini atlar ve
`0` ile çıkar. Bu nedenle kapıya dâhil edilmesi güvenlidir.

## Geri alma

`package.json` içindeki `check` betiği eski `&&` zincirine döndürülerek veya
`scripts/run-checks.mjs` ile `scripts/test-check-gate.mjs` silinerek geri
alınabilir; koşucu başka hiçbir modül tarafından içe aktarılmaz.
