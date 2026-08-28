# Kontrol Kapısı (`npm run check`)

Hafize'nin tek kalite kapısı `scripts/run-checks.mjs` betiğidir. `npm run check`
ve `npm test` aynı koşucuyu çağırır.

## Ne yapar?

1. **Syntax kapısı** — `server.mjs`, `lib/**/*.mjs`, `scripts/**/*.mjs` ve
   uygulama kabuğuna ait `public/*.js` dosyaları `node --check` ile taranır.
   Burada bir hata varsa testler koşturulmaz.
2. **Doğrulayıcılar** — `scripts/validate-agent-registry.mjs` gibi test öneki
   taşımayan betikler koşar.
3. **Testler** — `scripts/test-*.mjs` kalıbındaki her betik alfabetik sırada
   koşar.

Hedefler dosya sisteminden keşfedilir. Yeni bir `lib/` modülü veya
`scripts/test-*.mjs` dosyası eklendiğinde kapıya ayrıca kaydedilmesi gerekmez.

## Neden keşif?

Kapı daha önce `package.json` içinde elle tutulan tek satırlık bir `&&`
zinciriydi ve iki şekilde sessizce körleşti:

- Listeye yazılmayan test hiç koşmadı. Bu yolla 85 test betiğinden 32'si —
  OAuth PKCE, token şifreleme, token store ve personal-memory sahiplik
  kontrolleri dahil — kapının dışında kaldı.
- `&&` zinciri ilk hatada durduğu için tek bir eskimiş beklenti, kendisinden
  sonraki onlarca testi gizledi.

Koşucu ikisini de kapatır: hedefleri kendisi bulur ve bir test başarısız olsa
bile kalanları koşup sonunda başarısız hedeflerin tam listesini basar.

## Yeni test eklemek

Betiği `scripts/test-<konu>.mjs` olarak oluşturmak yeterlidir. Test başarılı
olduğunda tek satırlık bir özet basmalı, başarısız olduğunda sıfırdan farklı
bir kodla çıkmalıdır (`node:assert/strict` bunu kendiliğinden yapar).

## Dış bağımlılık gerektiren testler

Canlı bir servise ihtiyaç duyan testler, ortam değişkeni tanımlı değilse
kendini atlamalı ve 0 koduyla çıkmalıdır. Örnek:
`scripts/test-redis-schedule-lease-live.mjs`, `HAFIZE_TEST_REDIS_URL` yoksa
atlandığını yazıp çıkar. Böylece kapı ağ erişimi olmayan ortamlarda da
deterministik kalır.
