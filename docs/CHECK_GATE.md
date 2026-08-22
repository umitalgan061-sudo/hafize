# Check gate sözleşmesi

`npm run check` Hafize'nin tek doğrulama kapısıdır ve `scripts/run-checks.mjs`
tarafından yürütülür.

## Neden değişti

Gate daha önce `package.json` içinde elle tutulan tek satırlık bir komut
zinciriydi. İki yapısal sorun üretti:

1. **Sessiz kapsam kaybı.** 85 test dosyasından 33'ü hiçbir zaman zincire
   eklenmemişti; yazılmış ama hiç çalışmayan testlerdi.
2. **Zincir kırılması.** `&&` zincirinde ilk başarısız adım kendisinden sonraki
   her testi maskeliyordu. `scripts/test-tool-runtime.mjs` içindeki eski tool
   katalog beklentisi bu yüzden `main` üzerinde gate'i kırdı ve arkasındaki
   ikinci gerçek hatayı (Gmail read client'ın `read(null)` çağrısında tipli
   hata yerine ham `TypeError` sızdırması) görünmez kıldı.

## Şimdiki davranış

- Kaynak dosyaları diskten keşfedilir: kök `*.mjs`, `lib/*.mjs`,
  `scripts/*.mjs` ve `public/*.js` için `node --check` çalıştırılır.
- Sözdizimi hatası varsa testler çalıştırılmadan gate kırılır.
- `scripts/validate-agent-registry.mjs` ve keşfedilen tüm
  `scripts/test-*.mjs` dosyaları sırayla çalıştırılır.
- Bir test kırılsa bile kalan testler çalışmaya devam eder; sonunda başarısız
  olanların tam çıktısı raporlanır ve çıkış kodu 1 olur.
- Hiç test dosyası bulunamazsa gate başarısız sayılır; boş keşif sessizce yeşil
  dönmez.

## Yeni test ekleme

`scripts/` altına `test-*.mjs` adıyla bir dosya eklemek yeterlidir. Gate'i veya
`package.json`'ı güncellemek gerekmez. Testin başarısı çıkış kodu 0 ile,
başarısızlığı sıfır dışı çıkış koduyla bildirilir.

## Harici servis gerektiren testler

Canlı bağımlılığı olan testler kendi içinde atlanabilir olmalıdır.
`scripts/test-redis-schedule-lease-live.mjs` bu deseni izler:
`HAFIZE_TEST_REDIS_URL` tanımlı değilse atladığını yazar ve 0 ile çıkar.

## Gate'in kendi testi

`scripts/test-check-gate.mjs` gate'i geçici bir fixture kökünde
(`HAFIZE_CHECK_ROOT`) çalıştırarak şunları doğrular: geçen testler yeşil döner,
başarısız test çıkış kodunu ve hata çıktısını kaybetmez, sözdizimi hatası
testlerden önce yakalanır ve boş keşif başarısızlıktır. Bu ortam değişkeni
yalnız test içindir; üretim yolunda depo kökü dosya konumundan türetilir.

## Geri alma

`package.json` içindeki `check` script'ini önceki komut zincirine döndürmek ve
`scripts/run-checks.mjs` ile `scripts/test-check-gate.mjs` dosyalarını silmek
yeterlidir. Test dosyalarının kendisi değişmedi.
