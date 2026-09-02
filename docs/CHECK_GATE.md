# Kalite kapısı (`npm run check`)

Hafize'nin tek doğrulama kapısı `scripts/run-checks.mjs`'dir. `npm run check` ve
`npm test` aynı runner'ı çalıştırır.

## Neden değişti

Kapı önceden `package.json` içinde elle tutulan tek satırlık `&&` zinciriydi.
Bu iki somut soruna yol açtı:

1. **Sessiz kapsam kaybı.** Yeni bir test dosyası zincire yazılmadığında hiç
   çalışmıyordu. Değişim anında depodaki 85 test dosyasının 33'ü — tüm OAuth,
   token şifreleme, kişisel bellek ve connector read-client testleri dahil —
   kapının dışındaydı.
2. **İlk hatada durma.** `&&` zinciri ilk başarısızlıkta kırıldığı için o
   noktadan sonraki her test atlanıyordu. `test-tool-runtime.mjs` bayat bir
   araç listesi öne sürdüğü için kapı kırmızıydı ve arkasındaki testlerin
   sonucu görünmüyordu.

## Sözleşme

- `scripts/test-*.mjs` kalıbındaki **her** dosya bir testtir ve otomatik keşfedilir.
  Kaydolmak için başka bir adım yoktur.
- `server.mjs`, `lib/*.mjs`, `public/*.js` ve `scripts/*.mjs` dosyalarının tamamı
  `node --check` sözdizimi taramasından geçer.
- Bir test başarısız olsa bile kalan testler çalışır; tüm hatalar sonda birlikte
  raporlanır ve süreç sıfır olmayan kodla biter.
- Ağ, servis veya credential gerektiren testler kapıdan **çıkarılmaz**; kendi
  içlerinde env guard ile atlanır. Örnek: `scripts/test-redis-schedule-lease-live.mjs`
  `HAFIZE_TEST_REDIS_URL` tanımlı değilse temiz şekilde atlar.
- Testler sıralı çalışır; geçici dosya kullanan testler `mkdtemp` ile kendi
  dizinlerini açar.

## Kullanım

```bash
npm run check                              # sözdizimi + tüm testler
node scripts/run-checks.mjs gmail canva    # yalnız adı eşleşen testler
node scripts/run-checks.mjs --tests-only   # sözdizimi taramasını atla
node scripts/run-checks.mjs --syntax-only  # yalnız sözdizimi taraması
node scripts/run-checks.mjs --list         # keşfedilen testleri listele
node scripts/run-checks.mjs --root <dizin> # başka bir ağaç üzerinde çalış
```

`--root` yalnız kapının kendi testi (`scripts/test-check-gate.mjs`) için vardır;
izole bir sandbox ağacında hata toplama davranışını doğrular.

## Regresyon koruması

`scripts/test-check-gate.mjs` şunları kilitler:

- `package.json` içindeki kapı komutu keşif tabanlı kalır; hiçbir npm script'i
  tekil `scripts/test-...` yolu içermez.
- Diskteki her `test-*.mjs` dosyası keşfedilen listede yer alır.
- Başarısız bir test kapıyı durdurmaz; sonraki testler yine çalışır.
- Başarısız testin çıktısı raporda görünür, exit kodu 1 olur.
- Eksik bir kaynak dizini kapıyı çökertmez.

## Geri alma

Runner tek dosyadır. `scripts/run-checks.mjs` ve `scripts/test-check-gate.mjs`
silinip `package.json` içindeki `check` script'i eski komut zincirine
döndürülürse davranış tamamen eski haline döner.
