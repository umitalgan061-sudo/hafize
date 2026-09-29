# Koleksiyon Rollback

Rollback PR'ı revert ederek yapılabilir.

Revert sonucunda prompt library temel işlevleri korunur.

Collection storage anahtarlarının cihazda kalması veri kaybı oluşturmaz.

Rollback sonrasında Prompt Library export/import işlemleri çalışmaya devam eder.

Varsayılan collection ayarı aktif module geri geldiğinde tekrar okunabilir.

Silinmiş collection geri yüklenmek isteniyorsa önceden alınmış collection export import edilebilir.

Import sırasında mevcut aynı isimli koleksiyon korunacağı için rollback sonrası tekrar ekleme duplicate isim üretmez.

Assignment ilişkileri export yedeğinden yeniden kurulabilir.

Rollback sırasında prompt içeriklerini silmek gerekmez.

Service worker cache yeni assetleri içeriyorsa eski uygulama shell'i activation döngüsünde temizlenebilir.

Operasyonel geri alma doğrulaması: sayfa açılır, prompt library kartı görünür, create/edit/delete çalışır.

Collection modülü olmadan prompt kütüphanesinin çekirdek localStorage anahtarı değişmeden kalmalıdır.
