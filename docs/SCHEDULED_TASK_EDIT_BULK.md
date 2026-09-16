# Schedule Bulk Controls

Bulk kontroller yalnız `scheduled` durumundaki görevleri seçilebilir yapar.

Seçim sayısı en fazla 40'tır. Bu sınır tarayıcı tarafında UX ve bounded işlem sınırı sağlar.

`+15 dk` ve `+1 saat` her seçilen schedule için PATCH gönderir ve yalnız runAt alanını değiştirir.

`Seçilenleri iptal et` her seçilen kayıt için DELETE gönderir ve işlem öncesinde kullanıcı onayı ister.

İşlem sonunda seçim temizlenir ve liste yenilenir.

Kısmi başarısızlıkta başarı/target sayısı status alanında gösterilir; sunucu state'i yenilemeyle esas alınır.

Bulk işlem yeni server-side batch endpointi oluşturmadığı için mevcut ownership ve state kontrollerinden geçer.
