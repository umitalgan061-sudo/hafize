# Cloud session scrypt resource policy

## Amaç

Hafize cloud-session parolası repoda veya istemci tarafında tutulmaz. Sunucu yalnız `HAFIZE_CLOUD_SESSION_PASSWORD_HASH` içindeki scrypt parametrelerini kullanarak giriş parolasını doğrular. Bu parametreler deploy/config sahibi tarafından sağlansa da uygulama bunları sınırsız kaynak tüketme yetkisi olarak kabul etmez.

Önceki sözleşmede `N`, `r` ve `p` ayrı ayrı sınırlandırılıyordu. Ancak tek tek geçerli olan üst değerlerin birleşimi Node sürecinden gigabaytlarca `maxmem` talep edebilir ve tek bir login isteğini availability/OOM riskine dönüştürebilirdi. Bu belge birleşik kaynak politikasını sabitler.

## Fail-closed sınırlar

`lib/cloud-session-auth.mjs` password hash parse edilirken, herhangi bir `scrypt()` çağrısından önce aşağıdaki maliyetleri hesaplar:

- tahmini çekirdek bellek: `128 * N * r` byte,
- toplam iş birimi: `N * r * p`,
- Node `maxmem`: tahmini bellek + 1 MiB güvenlik payı, en az 32 MiB.

Kabul edilen üst sınırlar:

- `maxmem <= 256 MiB`,
- `N * r * p <= 4,194,304` iş birimi.

Sınır aşılırsa runtime `INVALID_CLOUD_SESSION_AUTH:passwordHash.cost` ile startup/config aşamasında fail-closed olur. Parola derivasyonu başlatılmaz ve unsafe parametre daha sonra login trafiğiyle tetiklenemez.

## Mevcut scalar şema korunur

Birleşik politika eski doğrulamaların yerine geçmez. Hash hâlâ şu şartları sağlamalıdır:

- biçim `scrypt$N$r$p$salt$digest`,
- `N` 16.384–1.048.576 arasında ve iki kuvveti,
- `r` 8–32,
- `p` 1–8,
- salt canonical base64url ve 16–64 byte,
- digest canonical base64url ve 32–64 byte.

Bu değerlerin scalar aralık içinde olması birleşik kaynak bütçesini aşmaya izin vermez.

## Uyumlu örnekler

Aşağıdaki profiller yeni politika içinde kalır:

- `16384 / 8 / 1`,
- `32768 / 8 / 1`,
- `65536 / 8 / 1`,
- `131072 / 8 / 1`,
- `65536 / 8 / 8`,
- `131072 / 8 / 4`.

Son iki örnek 4.194.304 iş birimi sınırına tam olarak ulaşır ve kabul edilir.

## Reddedilen örnekler

Aşağıdaki profiller scalar olarak kısmen geçerli görünse bile combined policy tarafından reddedilir:

- `262144 / 8 / 1`: çekirdek bellek 256 MiB'a ulaştığı için 1 MiB güvenlik payıyla maxmem sınırını aşar,
- `131072 / 16 / 1`: bellek bütçesini aşar,
- `65536 / 32 / 1`: bellek bütçesini aşar,
- `131072 / 8 / 5`: bellek altında olsa da iş birimi sınırını aşar,
- `1048576 / 32 / 8`: hem bellek hem iş bütçesini aşar.

## Güvenlik özellikleri değişmez

Bu politika yalnız parola doğrulama resource boundary'sini daraltır. Aşağıdakileri değiştirmez:

- scrypt digest karşılaştırmasında timing-safe davranış,
- session HMAC imzası,
- random nonce üretimi,
- `__Host-` cookie, `HttpOnly`, `Secure`, `SameSite=Strict`,
- 1–12 saat bounded session TTL,
- login rate limiter,
- exact HTTPS Origin kontrolleri,
- logout revocation,
- privileged GitHub/schedule cookie fallback Origin sınırı,
- backend default-deny tool policy,
- external write/send/merge için explicit approval,
- secret değerlerinin agent context'e girmemesi.

## Operasyon notu

Deploy sırasında kullanılan mevcut scrypt hash bu yeni sınırı aşarsa Hafize config'i bilerek reddeder. Çözüm çalışma zamanında limiti yükseltmek değildir; uygun interaktif-login parametreleriyle yeni password hash üretmek ve bunu platform secret/env yönetimi üzerinden değiştirmektir. Self-development ajanı `.env`, secret veya credential değerlerini oluşturmaz, okumaz veya commit etmez.

## Test sözleşmesi

Canonical `npm run check` tarafından keşfedilen testler şunları kilitler:

- yaygın profillerin geriye uyumluluğu,
- exact memory/work threshold davranışı,
- scalar ve combined hata kodlarının ayrılığı,
- gerçek minimum-cost scrypt login + cookie authentication,
- Node server runtime'ın unsafe config'i handler açmadan reddetmesi,
- `maxmem` değerinin login sırasında yeniden untrusted parametrelerden hesaplanmaması,
- dört profilli seçici ajan mimarisi ve secret/default-deny sınırlarının korunması.

## Geri alma

Geri alma halinde yalnız combined cost doğrulaması, exported limit metadata'sı, bu belge ve ilgili regresyon testleri revert edilir. Cookie biçimi, password hash biçimi, persistent veri veya session schema migrasyonu yoktur.
