# OAuth güvenlik sınırı

Bu katman gerçek bir Google/Gmail connector çağrısı yapmaz. OAuth sağlayıcıları bağlanmadan önce ortak Authorization Code + PKCE güvenlik primitive'lerini sabitler.

- PKCE yalnız S256 kullanır; verifier cryptographic random ile üretilir.
- OAuth state cryptographic random ve tek kullanımlıdır.
- Authorization ve redirect URL'leri HTTPS olmak zorundadır.
- Callback yalnız `code + state` veya `error + state` biçimlerinden birini kabul eder.
- Callback bilinmeyen alanları reddeder.
- Process-local flow store yalnız izole/embedded kullanım içindir; çok-instance production akışı shared Redis store kullanmalıdır.
- Shared store state key'ini domain-separated SHA-256 digest olarak tutar; state, PKCE verifier ve owner kimliği Redis'te plaintext değildir.
- Shared flow payload AES-256-GCM ile şifrelenir, TTL'lidir ve callback state'i atomik GET+DEL ile yalnız bir kez tüketilebilir.
- Authenticated owner flow başlatılırken server-side kayda bağlanır; callback owner bilgisini URL/query/body'den kabul etmez.
- Callback başka instance'a düşse bile aynı encrypted flow kaydını tüketebilir; tekrar kullanım fail-closed reddedilir.
- Redis unavailable, tamper, expiry veya shutdown sonrası reconnect durumları fail-closed kalır.
- Client secret, bearer token, owner kimliği ve credential değerleri callback URL'sine, frontend'e veya ajan context'ine girmez.
- Provider scope allowlist'i bu ortak çekirdeğin üzerinde ayrı policy olarak uygulanmalıdır.

Google/Gmail için sonraki katman yalnız en az yetkili read-only scope allowlist'iyle başlamalıdır. Gönderme/değiştirme scope'ları ayrı açık kullanıcı onayı ve backend permission enforcement tamamlanmadan açılmamalıdır.
