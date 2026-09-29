# Model ve Ajan Tercihleri Rollback

## Kod rollback

PR revert edildiğinde model preference UI kodu kaldırılır.
Conversation storage korunur.
Backend model ve agent endpointleri değişmediği için ayrıca backend rollback gerekmez.

## Veri rollback

Local preference key aynı cihazda kalabilir.
Eski sürüm key'i tanımıyorsa görmezden gelir.
Veri temizliği kullanıcıya açıkça anlatılmadan otomatik yapılmaz.

## Acil durum

UI bootstrap hatası varsa index üzerindeki CSS bağlantısı geri alınabilir.
PWA cache sürümü eski sürüme dönerken cache temizleme davranışı kontrol edilmelidir.

## Verification

1. Uygulama açılır.
2. Sohbet oluşturulur.
3. Model seçilir.
4. Agent seçilir.
5. Mesaj gönderilir.
6. Conversation history doğrulanır.
7. Preference panelinin kaldırıldığı doğrulanır.

## Geri dönüş dosyası

Kullanıcı export aldıysa profil verisi bağımsız şekilde saklanabilir.
Import yalnız yeni sürümün şema sözleşmesi doğrulandıktan sonra yapılmalıdır.
