# OAuth güvenlik sınırı

Bu katman gerçek bir Google/Gmail connector çağrısı yapmaz. OAuth sağlayıcıları bağlanmadan önce ortak Authorization Code + PKCE güvenlik primitive'lerini sabitler.

- PKCE yalnız S256 kullanır; verifier cryptographic random ile üretilir.
- OAuth state cryptographic random ve tek kullanımlıdır.
- Authorization ve redirect URL'leri HTTPS olmak zorundadır.
- Callback yalnız `code + state` veya `error + state` biçimlerinden birini kabul eder.
- Callback bilinmeyen alanları reddeder.
- Geçici flow store bounded ve TTL'lidir; state tüketildiğinde verifier kaydı hemen silinir.
- Expired veya tekrar kullanılan state fail-closed reddedilir.
- Process-local store yalnız local/test hazırlık katmanıdır; çok instance'lı production için `createRedisOAuthFlowStore` ile ortak, korumalı Redis kullanılmalıdır.
- Redis adapter state'i anahtar veya payload içinde düz metin tutmaz; domain-separated SHA-256 digest kullanır, PKCE verifier ise yalnız server-side payload içinde kalır.
- Issue ve consume Lua ile atomiktir; aynı callback state'ini instance'lar arasında yalnız bir consumer kazanabilir ve kapasite tüm instance'lar için ortak uygulanır.
- Shared TTL hesabı Redis server saatinden yapılır; instance clock skew tek-kullanımlık state ömrünü değiştiremez.
- OAuth runtime authorization URL'yi ancak store `issue` tamamlandıktan sonra döndürür; callback state'i henüz durable değilken dışarı sızmaz.
- Redis komutları 3 saniyelik deadline ile fail-closed çalışır; timeout/hata alan client sticky-unavailable olur ve yeniden kullanılmaz.
- Store kapanışı da bounded ve idempotenttir; askıda kalan graceful close `destroy()` fallback'i ile sonlandırılır.
- Client secret, token ve credential değerleri frontend'e, ajan context'ine veya repoya girmez.
- Provider scope allowlist'i bu ortak çekirdeğin üzerinde ayrı policy olarak uygulanmalıdır.

Google/Gmail için sonraki katman yalnız en az yetkili read-only scope allowlist'iyle başlamalıdır. Gönderme/değiştirme scope'ları ayrı açık kullanıcı onayı ve backend permission enforcement tamamlanmadan açılmamalıdır.
