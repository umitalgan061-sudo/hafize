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

## HTTP contract

Hazırlanan fakat henüz production `server.mjs` içine mount edilmeyen yollar:

- `POST /api/session/login` — exact `{password}` body ve exact HTTPS Origin ister.
- `GET /api/session/status` — cookie doğrular, yalnız authenticated boolean + expiry döndürür.
- `POST /api/session/logout` — authenticated session ve exact HTTPS Origin ister.

Tüm cevaplar `Cache-Control: no-store` taşır. Unknown login alanları, owner/token enjeksiyonu, cross-origin mutation ve raw backend error detail reddedilir.

## Yetki ayrımı

Session doğrulaması yalnız kullanıcı principal'ı üretir. Ajan registry ve backend default-deny tool enforcement değişmez. `external.write`, `external.send`, `repo.merge` veya connector write işlemleri session var diye otomatik onaylanmaz; kendi explicit approval kapıları korunur.

## Sonraki güvenli adım

Ayrı stacked PR'da bu runtime için environment bootstrap + `server.mjs` mount yapılmalıdır. Google OAuth start endpoint'i connector bearer yerine doğrulanmış cloud-session principal kabul edecek şekilde composition seviyesinde yeniden bağlanabilir. Callback owner binding yine server-side one-time OAuth state'ten çözülmeli; cookie subject veya client owner alanı callback'te yetki kaynağı olmamalıdır.

Production mount öncesinde HTTPS origin config, body limit/deadline, login rate limiting ve session signing-key rotation/revocation stratejisi ayrıca testlenmelidir.
