# Hafize cloud session authentication contract

## Amaç

Tarayıcı ve PWA'nın connector bearer secret'ını bilmeden Hafize backend'inde authenticated kullanıcı oturumu kurabilmesi için dar bir server-side session primitive'i tanımlar. Bu katman OAuth connector token'ı, agent tool izni veya dış yazma yetkisi değildir.

## Credential sınırı

- Sunucu plaintext parola saklamaz; yalnız `scrypt$N$r$p$salt$digest` biçiminde scrypt doğrulama kaydı kabul edilir.
- Session imza anahtarı parola hash'inden ayrıdır ve en az 256 bit rastgele anahtar olmalıdır.
- Parola, hash ve signing key session payload'a veya public response body'ye girmez.
- Connector bearer token bu akışta kullanılmaz ve browser'a verilmez.

## Session cookie

Cookie adı `__Host-hafize_session` olarak sabittir. Üretilen cookie `Path=/; HttpOnly; Secure; SameSite=Strict` taşır ve `Domain` içermez. Session payload yalnız sürüm, server-configured subject, issued-at, expiry ve rastgele nonce içerir; HMAC-SHA256 ile domain-separated biçimde imzalanır.

Session ömrü en fazla 12 saattir. Expired, future-issued, tamper edilmiş, duplicate veya oversized cookie fail-closed reddedilir. Logout stateless cookie expiry üretir; server-side revocation listesi bu ilk primitive'in kapsamında değildir.

## Production bootstrap

Cloud session runtime artık `server.mjs` içine mount edilir. Hiçbir cloud-session env alanı verilmezse runtime kapalıdır ve session yolları 404 döner; alanlardan yalnız bir kısmı verilirse sunucu listen aşamasına gelmeden fail-closed başlatma hatası üretir.

Gerekli environment alanları:

- `HAFIZE_CLOUD_SESSION_PASSWORD_HASH` — strict scrypt verifier.
- `HAFIZE_CLOUD_SESSION_SIGNING_KEY` — en az 256 bit base64url session signing key.
- `HAFIZE_CLOUD_SESSION_SUBJECT` — server-configured principal subject.
- `HAFIZE_CLOUD_SESSION_ORIGIN` — exact HTTPS browser origin.
- `HAFIZE_CLOUD_SESSION_TTL_MS` — opsiyonel; 1 dakika ile 12 saat arasında session TTL.

Health yalnız `cloudSessionConfigured` boolean'ını yayınlar; hash, signing key, subject veya origin dışarı verilmez.

## HTTP contract

Production yolları:

- `POST /api/session/login` — exact `{password}` JSON body ve exact HTTPS Origin ister.
- `GET /api/session/status` — cookie doğrular, yalnız authenticated boolean + expiry döndürür.
- `POST /api/session/logout` — authenticated session ve exact HTTPS Origin ister.

Login body varsayılan 1 KiB ile sınırlıdır ve 10 saniye deadline taşır. Login denemeleri doğrudan socket peer adresine göre varsayılan 5 deneme / 60 saniye ile sınırlandırılır; `X-Forwarded-For` güven kaynağı olarak kullanılmaz. Rate-limit anahtar havuzu bounded tutulur. Cross-origin istekler login kotasını tüketmeden reddedilir.

Tüm cevaplar `Cache-Control: no-store` taşır. Unknown login alanları, owner/token enjeksiyonu, cross-origin mutation ve raw backend error detail reddedilir. Oversized body 413, body deadline 408, unsupported media type 415 ve aşılmış login bütçesi 429 + `Retry-After` döndürür.

## Yetki ayrımı

Session doğrulaması yalnız kullanıcı principal'ı üretir. Ajan registry ve backend default-deny tool enforcement değişmez. `external.write`, `external.send`, `repo.merge` veya connector write işlemleri session var diye otomatik onaylanmaz; kendi explicit approval kapıları korunur.

## Sonraki güvenli adım

Google OAuth start endpoint'i connector bearer yerine `CLOUD_SESSION_NODE_SERVER_RUNTIME.authenticator` üzerinden doğrulanmış cloud-session principal kabul edecek şekilde composition seviyesinde yeniden bağlanmalıdır. Callback owner binding yine server-side one-time OAuth state'ten çözülmeli; cookie subject veya client owner alanı callback'te yetki kaynağı olmamalıdır.

Signing-key rotation/revocation stratejisi ayrı bir değişiklik olarak ele alınmalıdır; mevcut stateless cookie sözleşmesi aktif signing key değiştiğinde eski session'ları doğal olarak geçersiz kılar.
