# Composer Ekleri — Geri Alma

## Dosyalar
1. composer-attachments.js
2. composer-attachments-policy.js
3. composer-attachments.css
4. index.html wiring
5. sw-policy.js shell entries
6. app.js attach button wiring

## Rollback
Önce attachment script ve CSS bağlantıları kaldırılır. Sonra shell assetleri ve cache version geri alınır. Son olarak app.js'deki attachment delegasyonu önceki bilgi mesajına döndürülür.

## Veri güvenliği
Attachment queue kalıcı olmadığı için rollback sırasında staged file içeriğini temizlemek gerekmez; sayfa yaşam döngüsü bunu zaten sona erdirir.

Daha önce normal message olarak gönderilmiş içerik conversation history'de kalabilir. Rollback geçmiş mesajları geriye dönük silmez.

## Doğrulama
Rollback sonrası index.html artık attachment assetlerini yüklememeli ve sw-policy shell listesinde attachment assetleri kalmamalıdır.

## Geri dönüş
Kod yeniden açılacaksa aynı namespace kullanılabilir; var olan storage migration gerekmez.