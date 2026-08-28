# Kontrol kapısı (`npm run check`)

## Neden değişti

Kapı önceden `package.json` içinde elle tutulan tek satırlık dev bir komut zinciriydi. Bu yaklaşımın iki somut sorunu vardı:

1. **Sessiz kapsam kaybı.** Depodaki 86 test paketinden yalnızca 54'ü zincire eklenmişti. OAuth, PKCE, token şifreleme, token dosya deposu, Canva/Google token exchange, cihaz köprüsü ve kişisel bellek şifreleme testlerinin tamamı hiç çalışmıyordu. Yeni bir test dosyası eklendiğinde zincire elle eklenmediği sürece kapı onu görmüyordu.
2. **Kırılganlık.** Zincir `&&` ile bağlı olduğu için ilk başarısızlık kalan tüm kontrolleri durduruyordu; bir tur içinde kaç kontrolün bozuk olduğu görülemiyordu.

## Yeni yapı

- `lib/check-inventory.mjs` — saf keşif ve argüman sözleşmesi. Hangi dizinlerin taranacağı ve bir dosyanın test sayılma kuralı (`scripts/test-*.mjs`) burada tanımlıdır.
- `scripts/run-checks.mjs` — keşfedilen dosyaları çalıştıran ince koşucu.
- `scripts/test-check-inventory.mjs` — kapının kendi sözleşmesinin testi; diskteki her test paketinin keşfedildiğini doğrular.

## Kapı ne yapar

1. **Syntax**: `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` dosyalarının tamamına `node --check`.
2. **Registry**: `scripts/validate-agent-registry.mjs`.
3. **Testler**: keşfedilen tüm `scripts/test-*.mjs` paketleri.

İlk hatada durulmaz; tüm kontroller çalışır ve sonunda başarısız olanlar tek listede raporlanır. Herhangi bir kontrol başarısızsa çıkış kodu `1`'dir.

## Kullanım

```
npm run check                 # tam kapı
npm run check:only gmail      # yalnız adında "gmail" geçen paketler
node scripts/run-checks.mjs --only oauth --only canva
```

`--only` verildiğinde registry doğrulaması atlanır; syntax taraması her zaman tam kapsamda çalışır.

Bilinmeyen bir argüman sessizce yutulmaz, `INVALID_CHECK_INVENTORY` ile reddedilir.

## Yeni test eklerken

Dosyayı `scripts/test-<konu>.mjs` adıyla oluşturmak yeterlidir; kapıya elle kayıt gerekmez. `scripts/test-check-inventory.mjs` diskteki liste ile keşfedilen listeyi karşılaştırdığı için adlandırma kuralı dışına çıkan bir dosya fark edilir.

`scripts/test-redis-schedule-lease-live.mjs` canlı Redis ister; `HAFIZE_TEST_REDIS_URL` tanımlı değilse kendini atlar ve kapıyı kırmaz.

## Geri alma

`package.json` içindeki `check` script'ini eski zincire döndürmek ve bu turda eklenen üç dosyayı silmek yeterlidir; çalışma zamanı davranışı bu değişiklikten etkilenmez.
