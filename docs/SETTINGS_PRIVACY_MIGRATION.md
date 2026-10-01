# Migration Rehberi

Privacy Center mevcut storage formatlarını değiştirmez. Bu nedenle migration script'i gerekmez.

Yeni feature bir storage anahtarı eklediğinde:

1. SURFACES'e kaydet.
2. Storage key sözlüğünü güncelle.
3. Backup surface'ı gerekiyorsa workspace-backup'a ekle.
4. Inventory testi ekle.
5. Clear testi ekle.
6. Security testi ekle.
7. README'ye yüzeyi açıkla.
8. PWA asset'i değişiyorsa cache testini güncelle.

Anahtarın geçmiş sürümlerde farklı adı varsa compatibility layer açıkça belgelenmelidir.

Kullanıcı verisi otomatik taşınmamalı veya gizli biçimde silinmemelidir.
