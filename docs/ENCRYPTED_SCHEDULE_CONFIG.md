# Encrypted schedule storage config

Bu katman, encrypted schedule file adapter'ın ihtiyaç duyduğu dosya yolu ve 32-byte encryption key'i yalnızca server-side environment/config kaynağından doğrular.

## Ortam değişkenleri

- `HAFIZE_SCHEDULE_STORAGE_FILE`: encrypted schedule dosyasının mutlak server-side yolu.
- `HAFIZE_SCHEDULE_STORAGE_KEY_BASE64`: tam 32-byte anahtarın Base64 veya Base64URL kodlanmış değeri.

İki değer de yoksa config `null` döner ve encrypted persistence yapılandırılmamış kabul edilir. Yalnızca biri varsa veya değerlerden biri geçersizse `INVALID_ENCRYPTED_SCHEDULE_CONFIG` hatası üretilir.

## Güvenlik sınırları

- Key repo, `.env`, public/PWA JavaScript, HTML, manifest, agent context veya task payload içine yazılmaz.
- Decoder yalnızca canonical Base64/Base64URL ve decode edildiğinde tam 32 byte olan key kabul eder.
- Hata mesajı input veya secret ayrıntısı içermez.
- Dönen config frozen'dır.
- `key` enumerable değildir; `JSON.stringify(config)` key'i içermez.
- Her `config.key` erişimi yeni bir Buffer kopyası döndürür. Caller bu Buffer'ı mutate etse bile config içindeki saklanan key değişmez.
- Storage yolu mutlak olmak zorundadır; relative path reddedilir. Böylece process çalışma dizinine bağlı beklenmedik persistence konumu azaltılır.
- Gerçek server wiring sırasında storage yolu static `public/` ağacının dışında tutulmalıdır.

## Bu PR'ın yapmadıkları

Bu katman encrypted file adapter'ı `server.mjs` içine bağlamaz ve schedule command/worker akışını async persistence'a dönüştürmez. Bu geçiş ayrı testlerle küçük bir sonraki PR olarak yapılmalıdır.

Bu modül secret manager yerine geçmez. Production deployment'ta key environment/platform secret manager üzerinden sağlanmalı; source control'a commit edilmemelidir.
