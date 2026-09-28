# Görünen Görevleri Dışa Aktarma

Görev listesinde Görünenleri dışa aktar eylemi, kullanıcı tarafından o anda görünür olan en fazla 128 görevi JSON olarak cihazına indirir.

Dışa aktarma yalnız açık kullanıcı tıklaması ile yapılır. Dosya 250 KB sınırını aşarsa indirme yapılmaz.

Export endpointi yoktur. Browser, mevcut DOM'daki görev özetini oluşturur ve Blob indirimi başlatır. Credential veya Authorization başlığı eklenmez.

Dışa aktarma bir backup restore sistemi değildir; schedule kayıtlarının server-side sahipliği değişmez.
