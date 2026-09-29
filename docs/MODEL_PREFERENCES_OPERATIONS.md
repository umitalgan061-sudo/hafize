# Model ve Ajan Tercihleri Operasyon

## Gözlem

Özellik server-side telemetry üretmez.
Operasyon ekipleri kullanıcı profil listesini göremez.
Beklenen arıza sinyali kullanıcı arayüzündeki toast mesajlarıdır.

## Tipik olaylar

### Tercih kaydedilmiyor

Browser storage yazma erişimini kontrol et.
Private browsing veya storage policy nedeniyle hata olabilir.
Uygulama sohbet işlevine devam etmelidir.

### Profil görünmüyor

Storage anahtarının varlığını kontrol et.
Profil model veya agentId alanları boşsa normalize edilirken reddedilir.

### Profil uygulanmıyor

Ajan artık mevcut olmayabilir.
Model listesi yüklenmemiş olabilir.
Streaming sırasında değişiklik bilinçli olarak engellenir.

### Import reddediliyor

Dosya boyutunu kontrol et.
JSON biçimini kontrol et.
Geçersiz profil alanlarını temizle.
Aynı ID varsa sistem yeni ID üretir.

## Kurtarma

JSON export dosyası yerel geri dönüş yoludur.
Tercih reset işlemi yalnız kendi anahtarına dokunur.
Conversation history veya scheduled task storage geri alınmaz.

## Release sonrası kontrol

1. Uygulama açılır.
2. Model listesi yüklenir.
3. Ajan listesi yüklenir.
4. Tercihler paneli açılır.
5. Bir profil kaydedilir.
6. Profil uygulanır.
7. Sayfa yenilenir.
8. Seçimin kaldığı doğrulanır.
9. JSON export alınır.
10. JSON import denenir.
