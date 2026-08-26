# Check Gate

`npm run check` tek giriş noktasıdır ve `scripts/run-checks.mjs` tarafından yürütülür.

## Ne yapar

1. **Syntax pass** — `server.mjs`, `lib/*.mjs`, `public/*.js` ve `scripts/*.mjs` dosyalarının
   tamamı `node --check` ile taranır.
2. **Test pass** — `scripts/test-*.mjs` kalıbına uyan her dosya ayrı bir alt süreçte çalıştırılır.

Her iki liste de **disk üzerinden keşfedilir**; elle bakımı yapılan bir dosya listesi yoktur.
Yeni bir modül veya test eklendiğinde `package.json` düzenlemeye gerek kalmaz ve yeni dosya
kapının dışında kalamaz.

## Davranış sözleşmesi

- Kapı **ilk hatada durmaz**; bütün kontroller çalışır ve başarısız olanların tamamı sonda
  tek bir özet blokta raporlanır.
- Bir test 120 saniyede bitmezse `SIGKILL` ile sonlandırılır ve başarısız sayılır; asılı kalan
  bir test kapıyı süresiz bloklayamaz.
- Herhangi bir kontrol başarısızsa çıkış kodu `1`, hepsi geçerse `0` olur.
- `scripts/run-checks.mjs` kendisi `test-` ile başlamadığı için test olarak çalıştırılmaz,
  ancak syntax pass'e dahildir.

## Dış bağımlılık gerektiren testler

Canlı bir servise ihtiyaç duyan testler, ortam değişkeni yoksa kendi içinde atlanmalı ve
`0` ile çıkmalıdır — örneğin `scripts/test-redis-schedule-lease-live.mjs`,
`HAFIZE_TEST_REDIS_URL` tanımlı değilse atlandığını yazıp başarıyla biter. Kapı bu testleri
ayrıca dışlamaz; atlama kararı testin kendisine aittir.

## Kapının kendi testi

`scripts/test-check-gate.mjs` keşif sözleşmesini doğrular: disk üzerindeki her `lib/`, `public/`
ve `scripts/test-*` dosyasının keşfedildiğini, runner'ın test olarak çalıştırılmadığını ve
`package.json` içinde kapıya paralel ikinci bir komut listesi bulunmadığını kontrol eder.

## Neden bu şekilde

Önceki kapı, `package.json` içinde elle bakımı yapılan tek satırlık uzun bir `&&` zinciriydi.
İki sorun üretti:

- Zincir ilk hatada durduğu için, zincirin başındaki bayat bir test sonraki ~100 kontrolün
  hiç çalışmamasına yol açtı.
- 31 test dosyası ve 27 `lib/` modülü zincire hiç eklenmemişti; bu dosyalar için "testler geçti"
  ifadesi doğru değildi.

Keşif tabanlı runner bu iki sınıf hatayı yapısal olarak ortadan kaldırır.

## Geri alma

`package.json` içindeki `check` komutunu eski zincire döndürmek ve `scripts/run-checks.mjs` ile
`scripts/test-check-gate.mjs` dosyalarını silmek yeterlidir; başka hiçbir modül runner'a bağlı
değildir.
