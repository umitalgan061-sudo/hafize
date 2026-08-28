# Doğrulama Kapısı (`npm run check`)

## Amaç

Her self-development turunun sonunda çalıştırılan tek doğrulama kapısı. Kapı,
`scripts/run-checks.mjs` tarafından yürütülür ve dosya keşfine dayanır.

## Kapsam

Kapı iki aşamalıdır ve her iki aşama da dosya sisteminden keşfedilir:

1. **Söz dizimi** — `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js`
   dosyalarının tümü `node --check` ile doğrulanır.
2. **Testler** — `scripts/validate-agent-registry.mjs` ve `scripts/test-*.mjs`
   deseniyle eşleşen tüm test scriptleri sırayla çalıştırılır.

Her aşama tüm hedefleri çalıştırır; ilk hatada durmaz. Böylece tek turda birden
fazla kırık nokta birlikte görülür. Kapı, herhangi bir hedef başarısız olursa
sıfırdan farklı çıkış kodu döndürür ve başarısız her hedefin son satırlarını
raporlar.

## Neden keşif tabanlı?

Kapı daha önce `package.json` içinde elle bakımı yapılan tek bir dev komut
dizesiydi. Yeni bir modül veya test dosyası eklendiğinde bu dizeye kaydedilmeyi
unutmak sessiz bir kapsam kaybı yaratıyordu:

- 85 test scriptinin 32'si (tüm OAuth, token şifreleme, Canva/Gmail read client
  ve personal-memory testleri dahil) kapının tamamen dışındaydı.
- `lib/tool-runtime.mjs` içine `canva_read` ve `gmail_read` araçları
  kaydedildiğinde `scripts/test-tool-runtime.mjs` güncellenmedi; kapı bu yüzden
  bir süre boyunca kırmızıydı ve bu fark edilmedi.

Keşif tabanlı kapı bu hata sınıfını yapısal olarak ortadan kaldırır: bir dosya
diskte varsa kapının içindedir.

## Yeni test veya modül eklerken

Ek bir kayıt adımı yoktur. `scripts/test-<konu>.mjs` adında bir dosya oluşturmak
ve dosyanın hata durumunda sıfırdan farklı kodla çıkmasını sağlamak yeterlidir
(`node:assert/strict` kullanımı mevcut testlerle tutarlıdır).

`test-*` deseniyle eşleşmeyen bir doğrulayıcı eklenirse
`scripts/run-checks.mjs` içindeki `EXTRA_VALIDATORS` listesine eklenir.

## Sınırlar

- Testler sırayla çalışır; her hedef için 120 saniyelik zaman aşımı uygulanır.
- Kapı ağ erişimi veya secret gerektirmez. Dış servis çağrıları testlerde
  enjekte edilen sahte `fetch` uygulamalarıyla karşılanır.
- `scripts/run-checks.mjs` kendisi de söz dizimi aşamasında kontrol edilir,
  ancak test olarak çalıştırılmaz (`test-*` deseniyle eşleşmez).

## Geri alma

`package.json` içindeki `check` script'i eski komut dizesine döndürülerek veya
`scripts/run-checks.mjs` silinerek geri alınabilir. Kapı davranışı dışında
üretim kodu etkilenmez.
