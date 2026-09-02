# Canva connector güvenlik sözleşmesi

Hafize'nin Canva Connect entegrasyonu varsayılan olarak salt-okunur ve backend tarafından sınırlandırılmıştır.

## Kimlik ve owner kapsamı

- Model veya istemci `ownerId` seçemez.
- Connector isteği yalnız backend bearer doğrulamasından geçen principal ile yetkili hale gelir.
- Principal subject'i 32-byte backend anahtarıyla HMAC-SHA256 üzerinden opak owner kimliğine dönüştürülür.
- Raw subject generic tool runtime context'ine ve model mesajlarına taşınmaz.

## Token sınırı

- Access/refresh token'lar istemciye veya ajan bağlamına verilmez.
- Token kayıtları owner + provider kapsamıyla server-side encrypted store'da tutulur.
- API çağrıları yalnız sabit Canva origin/path allowlist'i üzerinden yapılır; model serbest URL veremez.
- Connector status endpoint'i token, owner, scope veya subject döndürmez; yalnız `linked` boolean'ı yayınlar.

## Tool yetkisi

- `canva_read` backend tool permission adı `connector.canva.read` olan salt-okunur bir araçtır.
- Araç yalnız authenticated request context ve hazır read boundary birlikte mevcutsa NVIDIA tool kataloğuna girer.
- Bu izin yalnız kullanıcıya görünen `hafize-general` ajanında allowlist'tedir; uzman ajanlara otomatik miras kalmaz.
- Write/delete/share işlemleri bu araç kapsamında değildir ve ayrı açık kullanıcı onayı olmadan eklenemez.

## Fail-closed davranışı

- Connector auth/subject/owner-key yapılandırması kısmiysa runtime başlamaz.
- Connector tamamen yapılandırılmamışsa normal Hafize sohbeti çalışabilir fakat Canva tool sunulmaz.
- Yanlış veya eksik bearer auth Canva tool'u görünmez bırakır ve status isteğini reddeder.
- Bilinmeyen tool alanları, write operasyonları, serbest URL ve model-supplied credential alanları reddedilir.

Bu sözleşme `agents/registry.json`, `lib/canva-agent-runtime.mjs`, `lib/canva-read-tool-boundary.mjs`, `lib/canva-read-client.mjs` ve `lib/tool-runtime.mjs` tarafından birlikte uygulanır.

## Girdi sözleşmesi: nesne olmayan istek ve context

Read client (`read`), token exchange/refresh ve tool boundary (`execute`)
girdileri `null`, dizi, sayı veya string ise ham `TypeError` yerine sözleşmeli
`INVALID_CANVA_*` hatası üretilir. `function f({ a } = {})` biçimindeki
varsayılan yalnız `undefined` için çalıştığı ve `null` destructuring sırasında
patladığı için bu ayrım açıkça kodlanmıştır: çağıranın hata sınıflandırması
sözleşme hatasını "geçersiz istek" olarak tanır ve iç uygulama detayı
mesaja sızmaz.

Geçersiz execution context, eksik context ile aynı biçimde ele alınır; owner
çözümlemesine ve alt istemciye hiç ulaşılmaz. Regresyon kapsamı:
`scripts/test-boundary-input-hardening.mjs`.
