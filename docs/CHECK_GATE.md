# Check Gate — `npm run check`

## Amaç

Hafize deposunda tek bir doğrulama kapısı vardır: `npm run check` (`npm test` aynı komutun
takma adıdır). Kapı `scripts/run-checks.mjs` tarafından yürütülür.

## Sözleşme

1. **Keşif zorunludur.** `scripts/test-*.mjs` kalıbına uyan her dosya otomatik olarak
   çalıştırılır. Yeni bir test dosyası eklemek onu kapıya dahil etmek için yeterlidir;
   ayrıca `package.json` düzenlenmez.
2. **Sözdizimi taraması otomatiktir.** `server.mjs`, `lib/*.mjs`, `public/*.js` ve
   `scripts/*.mjs` dosyalarının tamamı `node --check` ile taranır.
3. **İlk hatada durulmaz.** Bir suite başarısız olduğunda kapı çalışmaya devam eder ve
   sonunda bulduğu tüm başarısızlıkları tam çıktılarıyla raporlar; çıkış kodu `1` olur.
4. **Testler sırayla çalışır.** Geçici dosya kullanan suite'lerin birbirine karışmaması
   ve çıktının okunabilir kalması için yürütme serialdir; sözdizimi taraması paraleldir.
5. **Ortam gerektiren testler kendini atlar.** Örneğin `test-redis-schedule-lease-live.mjs`
   `HAFIZE_TEST_REDIS_URL` tanımlı değilse başarıyla atlanır. Ortam bağımlılığı kapının
   dışında bir liste ile değil, testin kendi içinde yönetilir.

## Neden keşif tabanlı

Önceki kapı, çalıştırılacak dosyaları `package.json` içinde elle sayılan uzun bir komut
zincirinde tutuyordu. Bu yüzden:

- `scripts/test-*.mjs` dosyalarının 32 tanesi hiçbir zaman çalıştırılmıyordu.
- Zincir ilk hatada durduğu için tek bir eskimiş assertion, arkasındaki onlarca suite'i
  görünmez hâle getiriyordu.

Keşif tabanlı kapı bu iki sınıf regresyonu yapısal olarak ortadan kaldırır.
`scripts/test-check-gate.mjs` bu sözleşmeyi kilitler: hiçbir test dosyası kapının dışında
kalamaz ve başarısız bir suite kapıyı kırmak zorundadır.

## Kullanım

```bash
npm run check                                  # tüm kapı
node scripts/run-checks.mjs                    # aynısı, npm olmadan
node scripts/test-tool-runtime.mjs             # tek suite
HAFIZE_TEST_REDIS_URL=redis://... npm run check # canlı Redis suite'i dahil
```

## Geri alma

`package.json` içindeki `check`/`test` script'lerini eski komut zincirine döndürmek veya
`scripts/run-checks.mjs` dosyasını silmek yeterlidir; suite dosyalarının kendisi
değişmediği için davranış kaybı olmaz.
