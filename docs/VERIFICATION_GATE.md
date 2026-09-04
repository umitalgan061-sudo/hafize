# Doğrulama gate'i

Hafize'nin tüm statik kontrolleri ve testleri `scripts/run-checks.mjs` üzerinden koşar.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run precheck` | Statik geçiş: `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` syntax kontrolü + `agents/registry.json` doğrulaması. |
| `npm run check` | `scripts/test-*.mjs` altındaki tüm testler. npm önce `precheck`'i otomatik çalıştırır. |
| `npm test` | Statik geçiş ve testler birlikte. |

## Neden keşif tabanlı

Gate daha önce `package.json` içinde elle tutulan uzun bir `&&` zinciriydi. Yeni bir modül
veya test dosyası eklendiğinde zincire eklemeyi unutmak sessiz bir kapsam boşluğu bırakıyordu:
85 test dosyasının 33'ü (tüm OAuth, PKCE, token şifreleme ve Canva read testleri dâhil)
hiç koşmuyordu. Bu boşluk yüzünden `lib/gmail-read-client.mjs` içindeki bir sözleşme
regresyonu ve `scripts/test-tool-runtime.mjs` içindeki eskimiş bir tool listesi fark edilmeden
`main` üzerinde kaldı.

Koşucu dosyaları dizinden keşfeder; bu nedenle bir dosyayı gate'e "eklemek" diye bir adım yoktur.

## Davranış

- Kontroller ayrı child process'lerde, sıralı ve deterministik (alfabetik) koşar.
- Bir test başarısız olduğunda koşum durmaz; tüm sonuçlar toplanır ve sonda tek özet basılır.
  Böylece tek turda birden fazla regresyon görülür.
- Her test için 120 sn, her statik kontrol için 30 sn zaman aşımı vardır; takılan bir koşum
  gate'i süresiz bekletemez.
- Başarısızlıkta çıkış kodu 1'dir ve yalnız başarısız kontrollerin çıktısı yazdırılır.

## Dış servis gerektiren testler

`scripts/test-redis-schedule-lease-live.mjs` canlı bir Redis örneği ister. Test,
`HAFIZE_TEST_REDIS_URL` tanımlı değilse kendi içinde atlanır ve gate'i kırmaz. Koşucu bu
dosyayı `EXTERNAL_SERVICE_TESTS` listesinde tutar; amaç davranışı değiştirmek değil,
atlamanın beklendiğini çıktıda görünür kılmaktır.

## Yeni test eklerken

1. Dosyayı `scripts/test-<konu>.mjs` adıyla oluştur.
2. Başarısızlıkta sıfırdan farklı çıkış kodu üret (`node:assert/strict` bunu sağlar).
3. Başarıda tek satırlık bir özet yazdır.
4. Ek bir kayıt adımı yoktur; `npm test` dosyayı kendiliğinden bulur.
