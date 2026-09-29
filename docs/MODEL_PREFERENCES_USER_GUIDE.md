# Model ve Ajan Tercihleri Kullanım Rehberi

## Tercihler düğmesi

Composer altındaki model seçim alanının yanında Tercihler düğmesi bulunur.

## Son seçimi hatırlatma

Bir model ve ajan seçtiğinde seçim cihazda kaydedilir.
Sayfayı yeniden açtığında aynı seçenekler geçerli listede bulunuyorsa geri yüklenir.
Sunucu tarafındaki model veya ajan listesi değişmişse geçersiz seçim zorla uygulanmaz.

## Profil kaydetme

Mevcut model, ajan ve araç durumunu profil olarak kaydedebilirsin.
Profil adına kısa ve anlaşılır bir ad vermek önerilir.
En fazla altı profil saklanır.

## Profil uygulama

Uygula seçildiğinde model ve aktif sohbetin ajan veya araç durumu güncellenir.
Profil uygulanması mesaj göndermez.
Sohbet geçmişindeki mesajlar değiştirilmez.

## Profil silme

Sil seçeneği açık onay ister.
Silinen profil JSON yedeğin varsa yeniden içe aktarılabilir.

## Sıralama

Aktif kombinasyona uyan profil ilk sırada görünür.
Sonraki sıralama kullanım sıklığına göre yapılır.
Kullanım sayısı profilin kaç kez uygulandığını gösterir.

## Yedekleme

Dışa aktar ile JSON dosyası indirilebilir.
İçe aktar ile daha önce oluşturulmuş dosya yüklenebilir.
Dosya 200 KB'dan büyükse reddedilir.
En fazla altı geçerli profil alınır.

## Sıfırlama

Tercihleri sıfırla son seçim ve profilleri temizler.
Açık onay olmadan silme yapılmaz.
Sıfırlama conversation history'yi etkilemez.

## Klavye

Ctrl veya Command + Shift + M tercih panelini açar.
Escape paneli kapatır.
Panel açıkken Tab odağı panel içinde tutar.

## Gizlilik

Tercihler bu tarayıcı profilinde tutulur.
Başka cihazlara kendiliğinden aktarılmaz.
Profil export dosyanı yalnız güvendiğin ortamlarda paylaş.
