# Schedule Edit Backward Compatibility

Mevcut schedule kayıtlarının ownerId, status, attempts ve execution alanları değişmeden kalır.

Eski consumer'lar yalnız GET/POST/DELETE kullanıyorsa yeni PATCH yüzeyi onları etkilemez.

Worker execution path'inde yeni bir status yoktur.

Persistence snapshot `schemaVersion: 1` ile açılır.

Encrypted schedule adapter yeni key derivation veya format gerektirmez.

Rollback halinde yeni oluşturulmuş kayıtlar mevcut kayıt şemasında kaldığı için worker tarafından okunabilir.

Client yeni UI asset'leri yükleyemese bile mevcut schedule API çalışır.
