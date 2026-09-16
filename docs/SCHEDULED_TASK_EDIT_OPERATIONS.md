# Schedule Edit Operations

Düzenleme işlemi mevcut schedule storage katmanını kullanır. Yeni bir storage biçimi oluşturmaz.

Persistence katmanında `update` mutation'ı diğer mutation'lar gibi sıralı kuyruk üzerinden çalışır. Aynı anda gelen iki update kalıcı state üzerinde deterministik sırayla uygulanır.

Bir update başarısız olursa mevcut state korunur ve sonraki mutation kuyruğa devam eder.

Başarılı update sonrası `updatedAt` yazılır ve `lastError` temizlenir; önceki `attempts` korunur.

Görev yeniden planlandığında worker'ın claim kriterleri değişmez: yalnız zamanı gelmiş `scheduled` kayıtlar çalışır.

Operasyon ekibinin worker'ı veya Redis lease ayarını değiştirmesi gerekmez.

API hata kodları log/izleme için stabil isimler kullanır. Kullanıcıya yalnız gerekli güvenli mesaj gösterilir.

Rollback sırasında PATCH yüzeyi geri alınabilir. Eski DELETE/GET/POST davranışları korunur.
