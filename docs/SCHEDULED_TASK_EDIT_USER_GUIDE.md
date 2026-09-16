# Görev düzenleme kullanıcı rehberi

Görevler panelini açtıktan sonra `Planlandı` durumundaki bir görevin altında `Düzenle` düğmesi görünür.

Düzenleme ekranında ajanı, görev metnini, çalıştırma zamanını ve maksimum deneme sayısını değiştirebilirsin. `Değişiklikleri kaydet` seçildiğinde sunucu görevi yeniden doğrular.

Daha hızlı bir değişiklik için `+15 dk` veya `+1 saat` düğmesi yalnızca çalıştırma zamanını ileri alır.

`Tekrar planla` mevcut görevden bağımsız yeni bir kayıt oluşturur. Böylece eski planın geçmişi korunur.

`Düzenlemeyi iptal et` seçildiğinde yapılan form değişiklikleri gönderilmez.

Görev çalışmaya başladıktan sonra düzenleme yapılamaz. Panel yenilendiğinde sunucu durumu esas alınır.

Tarayıcı görevin tamamını localStorage içine kopyalamaz. Schedule yanıtları service worker cache'ine de alınmaz.
