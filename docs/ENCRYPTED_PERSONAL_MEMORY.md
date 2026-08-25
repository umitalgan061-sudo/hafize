# Encrypted personal memory persistence

Hafize kişisel belleği kullanıcı kontrolünde ve server-side kalıcı hale getirirken plaintext snapshot saklamaz. Bu sınır `lib/encrypted-memory-persistence.mjs` içinde tanımlanır ve mevcut `personal-memory-store` snapshot sözleşmesini değiştirmeden şifreli bir persistence adaptörüne bağlar.

## Güvenlik modeli

- Şifreleme AES-256-GCM kullanır; gizlilik ve bütünlük birlikte doğrulanır.
- Her kayıt için 12 byte rastgele IV gerekir.
- Anahtar tam 32 byte olmalıdır ve repository, client bundle veya agent context içine girmez.
- `ownerId`, GCM additional authenticated data olarak bağlanır. Başka bir kullanıcıya ait envelope aynı key ile bile farklı owner kimliği altında açılamaz.
- Şifreli envelope yalnızca `version`, `algorithm`, `iv`, `tag` ve `ciphertext` alanlarını kabul eder. Ek alanlar fail-closed reddedilir.
- Bozuk ciphertext, yanlış owner veya yanlış key plaintext üretmez; işlem `MEMORY_DECRYPT_FAILED` ile kapanır.
- Persistence katmanı key'in nerede tutulduğunu belirlemez. Production `keyProvider`, cloud KMS/secret manager veya eşdeğer server-side key service kullanmalıdır.

## Adapter sınırı

`createEncryptedMemoryPersistence` dört dependency ister:

- `readEnvelope(ownerId)` — yalnızca ilgili kullanıcının şifreli envelope'unu okur.
- `writeEnvelope(ownerId, envelope)` — yalnızca şifreli envelope yazar.
- `deleteEnvelope(ownerId)` — kullanıcı kapsamındaki envelope'u siler.
- `keyProvider(ownerId)` — server-side 32-byte encryption key döndürür.

Adapter `load`, `save` ve `remove` metodlarını sunar. Bu API model sağlayıcısından ve ajan promptundan bağımsızdır. Tool permission enforcement ayrıca backend default-deny katmanında kalır.

## Bilerek yapılmayanlar

- Plaintext JSON memory dosyası yazılmaz.
- API key veya encryption key envelope içine eklenmez.
- Browser `localStorage` / IndexedDB kalıcı kişisel bellek deposu olarak kullanılmaz.
- Modelin kullanıcıdan açık niyet almadan memory write yapmasına izin verilmez; mevcut `normalizeMemoryWrite` sözleşmesi korunur.
- Silme semantiği gevşetilmez; mevcut exact-match memory delete sınırı korunur.
- Bu modül kendi başına bir filesystem path veya database seçmez. Storage backend ayrı, least-privilege adapter olmalıdır.

## Production wiring için sonraki adım

Server authentication principal ile doğrulanmış `ownerId` kullanılarak encrypted persistence adapter oluşturulmalı, memory store başlangıcında `load` edilen snapshot uygulanmalı ve başarılı write/delete işlemlerinden sonra snapshot atomik biçimde `save` edilmelidir. KMS erişim hatalarında fail-open yapılmamalı; kişisel bellek kullanımı devre dışı bırakılarak kullanıcıya görünür hata dönülmelidir.

## Test kapsamı

`scripts/test-encrypted-memory-persistence.mjs` şu davranışları doğrular:

- deterministic IV ile encrypt/decrypt round-trip,
- envelope içinde plaintext sızıntısı olmaması,
- owner-bound AAD,
- yanlış key ve ciphertext tampering reddi,
- katı envelope şeması,
- storage adapter load/save/remove akışı,
- dependency ve backend hata propagasyonu.
