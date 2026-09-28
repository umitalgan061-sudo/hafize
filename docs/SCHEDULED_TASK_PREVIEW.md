# Zamanlanmış Görev Önizlemesi

Zamanlanmış Görevler yüzeyindeki “Görevi planla” submit akışı artık önce yerel bir önizleme kapısından geçer. Önizleme açıkça onaylanana kadar görev API'sine POST gönderilmez.

## Kullanıcı akışı

1. Ajan, görev metni, çalıştırma zamanı ve maksimum deneme sayısı seçilir.
2. Önizleme capture listener submit olayını durdurur.
3. Kullanıcı görev metnini ve özet alanlarını görür.
4. Düzenle ile form değerleri korunarak panele dönülür.
5. Onayla ve planla yalnızca alanlar geçerliyse mevcut formu bir defa requestSubmit ile yeniden çalıştırır.
6. Preview tek kullanımlık bypass işaretini tüketir; mevcut schedule workspace POST handler çalışır.

## Güvenlik sınırı

Preview modülü kendi HTTP isteğini yapmaz. Fetch, XHR ve beacon API kullanmaz. Authentication, CSRF, ownership, rate limit ve schedule state transition mantığı mevcut backend ve typed workspace içinde kalır.

Önizleme yalnızca form alanlarından oluşturulan özeti gösterir. Sunucu yanıtı, credential, token veya gizli veri dialog'a aktarılmaz.

## Erişilebilirlik

Dialog role=dialog ve aria-modal=true ile yayınlanır. Başlık ve açıklama ARIA bağlantılarıyla ilişkilidir. Escape kapatır, Tab odağı içeride tutar, Ctrl/⌘+Enter onayı başlatır ve odağı açan elemana geri verir.

## Hata davranışı

Geçersiz ajan, boş görev veya geçmiş zaman varsa onay pasif kalır ve durum metni hatayı gösterir. Kullanıcı Düzenle ile formu değiştirince sonraki submit yeni bir önizleme üretir.

## Mobil

650px altında modal alta hizalanır, metadata tek sütuna iner ve iki aksiyon genişler.

## Geri alma

Preview bağımsız bir enhancement olduğu için JS ve CSS dosyalarının kaldırılması yeterlidir. Schedule API veya backend sözleşmesi migration gerektirmez.
