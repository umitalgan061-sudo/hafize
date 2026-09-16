# Schedule Edit Migration

Bu özellik mevcut schedule snapshot şemasını genişletmez. `schemaVersion` aynı kalır.

Eski kayıtlar olduğu gibi okunabilir. `update` yalnız çalışma zamanında mevcut entry alanlarını değiştirir.

Yeni deployment sonrası eski kayıtlar için veri dönüşümü çalıştırılmaz.

Encrypted persistence adapter aynı envelope biçimini kullanmaya devam eder.

Rollback sonrası eski uygulama update edilmemiş mevcut kayıtları okuyabilir; yeni feature'ın oluşturduğu alanlar mevcut entry şemasının parçasıdır.

Kullanıcı verisinin toplu migrasyonu gerekmez.

Release sırasında yalnız uygulama kodu ve testler deploy edilir.
