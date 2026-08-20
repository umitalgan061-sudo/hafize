# Personal memory approval boundary

Hafize kalıcı kişisel belleği kullanıcı kontrolünde tutar. `explicitUserIntent: true` alanı tek başına bir yetkilendirme mekanizması değildir; istemci tarafından üretilebildiği için kalıcı yazma, silme ve export işlemleri backend tarafından doğrulanan exact approval sınırından geçer.

## Akış

1. Kullanıcı mevcut Hafize arayüzünde kaydetme, silme veya ilgili yüksek etkili bellek eylemini açıkça başlatır.
2. İstemci `/api/memory/approval/prepare` endpoint'ine yürütmek istediği exact komutu gönderir.
3. Backend önce mevcut authentication ve same-origin mutation policy'sini uygular.
4. Backend komutu mevcut memory HTTP sözleşmesine göre normalize eder ve owner-scoped, kısa ömürlü bir approval token üretir.
5. İstemci aynı komutu asıl memory endpoint'ine `X-Hafize-Memory-Approval` header'ı ile gönderir.
6. Backend token imzasını, owner kimliğini, süreyi ve exact command digest'ini doğrular; nonce claim başarısızsa yürütme başlamaz.
7. Ancak doğrulama başarıyla tamamlandıktan sonra persistence runtime çağrılır.

Approval token yeni bir kullanıcı yetkisi yaratmaz. Authentication, origin kontrolü ve memory runtime'ın kendi explicit-intent/exact-delete kuralları korunur; token bunlara ek bir fail-closed katmandır.

## Exact command kapsamı

Approval aşağıdaki davranışlara bağlanır:

- `write`: kind, content, sourceType/sourceRef, sensitivity ve explicit user intent;
- `delete-one`: exact memory id + `exactMatch: true` + explicit user intent;
- `delete-all`: explicit user intent + açık delete-all confirmation;
- `export`: explicit user intent.

Alanların JSON sırası yetkilendirme anlamı taşımaz. Backend önce komutu canonical forma çevirir, daha sonra digest üretir. İçerik veya hedef memory id değişirse eski token kullanılamaz.

## Token ve secret sınırı

Token HMAC-SHA256 ile imzalanır ve secret istemciye veya agent context'ine verilmez. Mevcut owner anahtarı ayrı domain separator ile approval imzasında kullanılır; repoya yeni plaintext credential eklenmez. Token yalnız kısa ömürlü capability kanıtıdır ve uygulama secret'ı değildir.

Token payload'ı owner id, expiry, nonce ve command digest taşır. Ham bellek içeriği token payload'ına konulmaz; yalnız digest ile bağlanır.

## Replay davranışı

Bir nonce başarıyla consume edildiğinde aynı replay store içinde ikinci kez claim edilemez. Varsayılan replay store process-local ve bounded TTL cleanup uygular.

Bu varsayılan, tek process deployment için tek-kullanımlık davranış sağlar; **çok process / çok instance deployment için cluster-genel tek-kullanım garantisi değildir**. Yatay ölçekli production deployment'ta `replayStore.claim(...)` atomik bir shared store'a (örneğin mevcut güvenli Redis altyapısına uygun bir adapter) bağlanmalıdır. Shared claim eklenmeden cluster-genel replay koruması varmış gibi davranılmamalıdır.

Bu açık sınır, güvenlik iddiasını deployment topolojisinden bağımsız biçimde abartmamak içindir.

## Failure davranışı

- token yoksa: `MEMORY_APPROVAL_REQUIRED` ve persistence çağrısı yok;
- imza/token biçimi geçersizse: fail-closed;
- owner veya exact command eşleşmiyorsa: fail-closed;
- süre dolmuşsa: fail-closed;
- nonce daha önce claim edilmişse: fail-closed;
- approval prepare aynı-origin/auth policy'den geçmiyorsa token üretilmez.

İstemci prepare başarısız olduğunda execute isteği göndermemelidir. Böylece yalnız body içindeki `explicitUserIntent` boolean'ı ile kalıcı belleğe yazma veya silme yapılamaz.

## Değişmeyen kurallar

- Sessiz kalıcı memory write yoktur.
- Secret/credential değerleri memory context'e alınmaz.
- Delete exact-match davranışı korunur.
- Tool permission enforcement model sağlayıcısından bağımsız ve backend default-deny kalır.
- NVIDIA NIM ana provider seçimi bu sınırdan etkilenmez.
- `.env`, credential dosyaları ve `.github/workflows/` bu özellik tarafından değiştirilmez.
