# GitHub write activation boundary

Hafize'nin GitHub write yeteneği backend'de **default-deny** çalışır. Write credential'larının ortamda bulunması tek başına write HTTP yüzeyini açmaz.

## Açma koşulu

Production Node write runtime yalnız şu server-side değer exact `true` olduğunda etkinleşir:

`HAFIZE_GITHUB_WRITE_ENABLED=true`

Değer yoksa, boşsa veya `false` ise runtime `configured: false` döner ve hiçbir GitHub write route'unu match etmez. `1`, `yes`, `on` gibi belirsiz alias'lar kabul edilmez; yanlış değer yapılandırma hatasıdır.

Bu flag browser'a, ajan prompt'una veya public config'e taşınmaz. Yalnız backend process environment içinde değerlendirilir.

## Etkin durumdaki zorunlu yapılandırma

Explicit opt-in verildiğinde mevcut güvenlik sözleşmesinin tamamı yine zorunludur:

- `GITHUB_TOKEN`
- `HAFIZE_GITHUB_WRITE_REPOS`
- `HAFIZE_GITHUB_WRITE_APPROVAL_SECRET`
- `HAFIZE_GITHUB_WRITE_AUTH_TOKEN`
- `HAFIZE_GITHUB_WRITE_AUTH_SUBJECT`
- `HAFIZE_GITHUB_WRITE_OWNER_KEY`

Bunlardan biri eksikse runtime fail-closed olur. Kısmi yapılandırma write yüzeyini daha az güvenli bir moda düşürmez.

## Neden ayrı opt-in var?

GitHub tokenı aynı backend'de read amaçları için de bulunabilir. Bir deployment'a write secret'larının önceden provision edilmesi veya secret manager'ın tüm değişkenleri enjekte etmesi, HTTP write endpoint'lerinin istemeden aktif olması anlamına gelmemelidir.

Bu nedenle iki ayrı karar vardır:

1. Secret/configuration provision edilmiş mi?
2. Write özelliği bu deployment için açıkça etkinleştirilmiş mi?

İkinci karar exact opt-in flag ile verilir.

## Değişmeyen approval sözleşmesi

Flag yalnız route'un mevcut olup olmadığını belirler; kullanıcı onayının yerine geçmez.

- `prepare` yalnız owner/auth/repository doğrulamasından sonra command'a bağlı kısa ömürlü approval token üretir.
- `prepare` GitHub'a write çağrısı yapmaz.
- `execute` single-use approval token olmadan çalışmaz.
- Repository allowlist backend'de zorunludur.
- Approval token owner'a ve exact command'a bağlıdır.
- Response/connection kapanırsa Node boundary execution'ı abort eder.
- Agent tool policy provider'dan bağımsızdır; model seçimi write yetkisi vermez.
- Merge ve diğer dış yan etkiler mevcut açık onay kurallarını atlayamaz.

## Secret sınırı

Activation flag ve credential değerleri aşağıdaki yüzeylere taşınmaz:

- `public/` dosyaları,
- health response body,
- ajan context/prompt'u,
- task ledger,
- trace metadata,
- approval response body,
- runtime'ın public object yüzeyi.

Runtime dışarı yalnız `configured` ve `handle` sağlar.

## Deployment akışı

Güvenli açma sırası:

1. Dar repository allowlist'ini belirle.
2. Backend secret manager'da token ve approval/auth key'lerini provision et.
3. Uygulamayı write flag kapalıyken doğrula.
4. Kullanıcı approval akışını ve audit/trace davranışını doğrula.
5. Son olarak `HAFIZE_GITHUB_WRITE_ENABLED=true` ile write route'unu aç.

Kapatmak için flag'i `false` yapmak yeterlidir; credential'ların aynı anda silinmesine bağlı değildir. Credential rotation ve iptal işlemleri ayrıca secret yönetim prosedürüyle yapılmalıdır.

## Regresyon kanıtı

Canonical `scripts/test-*.mjs` testleri şu sınırları kilitler:

- full credential set mevcut olsa bile opt-in yokken runtime disabled kalır;
- disabled runtime request body okumaz, response yazmaz ve GitHub network çağrısı yapmaz;
- yalnız exact `true` etkinleştirir;
- invalid activation değeri fail-closed olur;
- `true` + eksik credential/config fail-closed olur;
- activation flag ve credential adları browser UI'a taşınmaz;
- enabled runtime'ın mevcut bearer auth + approval-token davranışı korunur.
