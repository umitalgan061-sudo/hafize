# Cloud Session Logout Revocation Contract

## Amaç

Hafize cloud session logout işlemi yalnız tarayıcı cookie'sini silmekle yetinmez. Kullanıcı logout verdiğinde, o anda doğrulanmış olan session token'ın daha önce kopyalanmış bir örneği de kalan TTL süresince server-side olarak geçersiz sayılmalıdır.

## Tehdit modeli

Bir saldırgan geçerli `__Host-hafize_session` cookie değerini logout öncesinde ele geçirmiş olabilir. Yalnız `Max-Age=0` göndermek saldırganın kopyasını silmez. Bu nedenle logout, clearing cookie dönmeden önce mevcut token'ı revoke eder. Sonraki `/api/session/status`, schedule auth veya cloud-session kullanan privileged backend yolları aynı token'ı `AUTH_REQUIRED` ile reddeder.

## Veri minimizasyonu

Revocation store ham cookie, bearer token, password hash, signing key veya principal payload saklamaz. Token, mevcut server-side session signing key ile domain-separated HMAC-SHA256 fingerprint'e çevrilir. Store yalnız:

- 43 karakterlik base64url fingerprint,
- orijinal session'ın `expiresAt` zamanı

saklar. Fingerprint loglanmaz veya istemciye dönmez.

## Bounded store ve fail-closed davranışı

Varsayılan store kapasitesi 4096 aktif revocation kaydıdır. Süresi dolmuş kayıtlar prune edilir. Aynı fingerprint'in tekrar revoke edilmesi ek kapasite tüketmez. Aktif store doluysa yeni geçerli logout `SESSION_REVOCATION_UNAVAILABLE` ile 503 döner ve clearing cookie gönderilmez. Böylece uygulama “logout başarılı” izlenimi verip ele geçirilmiş token'ı geçerli bırakmaz.

Revocation kaydı yalnız token'ın mevcut expiry zamanına kadar tutulur; logout session ömrünü uzatmaz.

Production varsayılanındaki revocable authenticator'lar aynı **process-local backing map** üzerinde çalışır. Bu paylaşım auth instance kimliğine veya aynı `now` fonksiyon nesnesini kullanmaya bağlı değildir. Böylece session HTTP runtime'ında revoke edilen token, aynı process içinde ayrı oluşturulmuş GitHub privileged veya schedule cookie authenticator tarafından da reddedilir. Özel `revocationStore` enjekte eden test/embedding kullanımları ise kendi store sınırını korur.

## Origin ve authentication sınırı

Logout hâlâ exact HTTPS Origin kontrolünden sonra çalışır. Foreign origin revocation başlatamaz. Token önce mevcut imza, subject, TTL ve nonce sözleşmesiyle doğrulanır; malformed, expired veya yanlış imzalı cookie revocation store'a eklenmez.

Ayrıcalıklı cookie fallback için origin sınırı logout'tan sonra da devam eder: GitHub write POST işlemleri ve schedule mutation işlemleri geçerli cookie yanında exact `HAFIZE_CLOUD_SESSION_ORIGIN` gerektirir. Server-to-server bearer kimliği bu browser-origin gereksiniminden bağımsızdır.

## Süreklilik sınırı

Store hâlâ process-local ve bounded memory kullanır. **Gerçek process restart/deploy revocation listesini temizler.** Yeni bir authenticator veya runtime nesnesi oluşturmak tek başına restart değildir; aynı Node process içindeki bu tüketiciler ortak deny-set'i görür. Dağıtık veya çok-instance production kurulumunda aynı fingerprint sözleşmesini kullanan Redis/ortak durable store ayrı bir geliştirme olarak eklenmelidir. Bu sınır “logout her restart sonrasında da revoke kalır” iddiası yapmaz.

## Mimari sınırlar

Bu değişiklik:

- yeni agent veya tool permission eklemez,
- dört profilli selector/specialist registry'yi değiştirmez,
- GitHub/Gmail/Canva write-send-merge approval davranışını değiştirmez,
- secret değerlerini agent context'e taşımaz,
- yeni network endpoint'i veya retry mekanizması eklemez,
- client storage, clipboard, shell, exec veya genel terminal yürütme eklemez,
- `.env`, credential dosyaları veya `.github/workflows/` üzerinde değişiklik yapmaz.

Revocation provider/model bağımsız cloud-auth boundary'sinde uygulanır.

## DoD / regresyonlar

Test sözleşmesi şunları kapsar:

1. Fingerprint deterministik ve token-spesifiktir; ham token store'a girmez.
2. Revocation expiry ile prune edilir ve capacity fail-closed davranır.
3. Gerçek session login sonrası status başarılıdır; logout sonrası aynı cookie replay'i 401 olur.
4. Yeni bağımsız session eski revocation nedeniyle engellenmez.
5. Duplicate/malformed/tampered cookie fail-closed olur.
6. Wrong-origin logout revocation yapmaz.
7. Store capacity doluysa logout 503 olur ve clearing cookie dönmez.
8. Production Node runtime revocable auth'ı varsayılan olarak kullanır.
9. Aynı process içinde farklı runtime/auth instance'ları revocation fingerprint deny-set'ini paylaşır.
10. Privileged cookie mutation'ları exact Origin gerektirirken bearer otomasyon kimliği geriye uyumlu kalır.
11. Agent roster ve backend default-deny sözleşmesi değişmez.

## Geri alma

Revert sırasında `cloud-session-revocable-auth.mjs`, HTTP logout revocation wiring'i, Node runtime default auth değişikliği, ilgili testler ve bu belge kaldırılır. Herhangi bir kalıcı schema/data migration olmadığı için ayrıca veri dönüşümü gerekmez.
