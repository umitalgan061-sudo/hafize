# Prompt Library — Smart Insert

Smart Insert, Prompt Library içindeki `{{değişken}}` alanları bulunan istemleri sohbet composer'ına kontrollü biçimde aktarmak için kullanılan yerel UI katmanıdır.

## Akış

1. Kullanıcı Prompt Library içinden **Akıllı doldur** seçeneğini açar.
2. İstemde bulunan değişkenler ayrı alanlar halinde gösterilir.
3. Her değer en fazla 1000 karakter olacak şekilde sınırlandırılır.
4. Alanlar dolduruldukça çözülmüş istem önizlemesi güncellenir.
5. İstenirse daha önce kaydedilmiş bir değişken profili seçilir.
6. Kullanıcı **Composer’a aktar** dediğinde yalnızca `#messageInput` güncellenir.
7. Gönderim otomatik değildir; kullanıcı normal gönder düğmesiyle açıkça gönderir.

## Değişken profilleri

Profiller cihazdaki `hafize.prompt-library.variable-profiles.v1` anahtarında tutulur. Her profil bir ad, sınırlı sayıda değişken değeri ve güncelleme zamanı taşır. Profil değerleri conversation history veya backend API'lerine gönderilmez.

Profil adları 60 karakterle, değişken sayısı 12 ile, değişken adları 32 karakterle, tek değer 1000 karakterle ve toplam profil sayısı 24 ile sınırlandırılır. Aynı isimde içe aktarılan profil mevcut profilin değerleriyle birleştirilir; mevcut profilin kimliği korunur.

## Yedekleme

Profil dışa aktarımı JSON biçimindedir. İçe aktarma 300 KB ile sınırlandırılır ve kayıt öncesi normalizasyon uygulanır. Geçersiz, boş veya aşırı büyük veri kabul edilmez.

## Gizlilik

Smart Insert sunucuya yeni bir telemetri veya analytics çağrısı eklemez. Profil verileri yalnızca tarayıcı local storage'ında tutulur. Dışa aktarma yalnızca kullanıcının açık eylemiyle yerel bir dosya oluşturur.

## Erişilebilirlik

Dialog `role="dialog"` ve `aria-modal="true"` kullanır. Başlık `aria-labelledby` ile bağlanır. Tab dolaşımı dialog içinde tutulur; Escape kapatır ve odak açma düğmesine döner. Mobilde alanlar tek kolon düzenine geçer. Reduced-motion ve forced-colors kullanıcı ayarları desteklenir.

## Hata davranışı

Composer bulunamazsa aktarım yapılmaz. Eksik değişken varsa ilk eksik alan odaklanır ve kullanıcıya durum mesajı verilir. Local storage yazma hataları sessiz veri kaybı yerine başarısızlık mesajıyla ele alınır. Dialog kapatıldığında geçici DOM ve gözlemci temizlenir.

## PWA

Smart Insert JavaScript ve CSS asset'leri service worker shell cache listesine eklenmiştir. Cache sürümü artırılarak eski shell ile yeni UI'nın karışması önlenir.

## Test kapsamı

`scripts/test-prompt-library-smart-insert-suite.mjs` kaynak sözleşmesini tek noktada doğrular: veri sınırları, profil API'leri, DOM güvenliği, modal erişilebilirliği, otomatik gönderim engeli, composer input senkronizasyonu, mobile/forced-colors/reduced-motion stilleri ve PWA cache asset'leri.

Tam davranış testi tarayıcı ortamında ayrıca yapılmalıdır; repository check sistemi bu sözleşme testini diğer `test-*.mjs` dosyalarıyla birlikte otomatik keşfeder.

## Geri alma

Smart Insert'i kaldırmak için PR revert edildiğinde temel Prompt Library ve kayıtlı prompt verisi korunur. Profil storage anahtarı da ayrı tutulduğu için veri migrasyonu gerektirmez. Service worker cache'i yeni sürümde eski cache'i temizleyerek normal shell akışına döner.
