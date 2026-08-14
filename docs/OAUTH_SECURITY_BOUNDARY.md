# OAuth güvenlik sınırı

Bu katman gerçek bir Google/Gmail connector çağrısı yapmaz. OAuth sağlayıcıları bağlanmadan önce ortak Authorization Code + PKCE güvenlik primitive'lerini sabitler.

- PKCE yalnız S256 kullanır; verifier cryptographic random ile üretilir.
- OAuth state cryptographic random ve tek kullanımlıdır.
- Authorization ve redirect URL'leri HTTPS olmak zorundadır.
- Callback yalnız `code + state` veya `error + state` biçimlerinden birini kabul eder.
- Callback bilinmeyen alanları reddeder.
- Geçici flow store bounded ve TTL'lidir; state tüketildiğinde verifier kaydı hemen silinir.
- Expired veya tekrar kullanılan state fail-closed reddedilir.
- Flow store process-local hazırlık katmanıdır; çok instance'lı production ortamında ortak, korumalı server-side store gerekir.
- Client secret, token ve credential değerleri frontend'e, ajan context'ine veya repoya girmez.
- Provider scope allowlist'i bu ortak çekirdeğin üzerinde ayrı policy olarak uygulanmalıdır.

Google/Gmail için sonraki katman yalnız en az yetkili read-only scope allowlist'iyle başlamalıdır. Gönderme/değiştirme scope'ları ayrı açık kullanıcı onayı ve backend permission enforcement tamamlanmadan açılmamalıdır.
