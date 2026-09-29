# Koleksiyon Gizlilik Bildirimi

Koleksiyon özelliği yerel çalışır.

Koleksiyon adı ve prompt ID atamaları cihazdaki localStorage alanında tutulur.

Bu modül collection verisini Hafize backend'ine göndermez.

Prompt gövdesi collection map içinde saklanmaz.

Export kullanıcı eylemiyle dosya oluşturur.

Import kullanıcının seçtiği yerel dosyayı okur.

Analitik veya uzaktan kullanım profili oluşturulmaz.

Koleksiyon silme prompt metnini silmez.

Tarayıcı storage temizlenirse koleksiyon metadata'sı kaybolabilir.

Kullanıcı kritik düzenlerini düzenli collection export ve Prompt Library export ile yedekleyebilir.

Yedek dosyaları hassas olabilir; paylaşmadan önce içerik kontrol edilmelidir.
