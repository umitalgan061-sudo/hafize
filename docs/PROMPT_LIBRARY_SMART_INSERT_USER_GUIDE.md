# Smart Insert — Kullanıcı Rehberi

## Değişkenli istemi açma

Prompt Library içindeki değişkenli bir istemde **Akıllı doldur** düğmesini kullan. Her `{{değişken}}` için ayrı alan açılır. Alanları doldurdukça önizleme güncellenir.

## Profilden doldurma

Daha önce oluşturduğun değişken profili varsa Smart Insert içindeki **Değişken profili** alanından seç. Profilde kayıtlı değerler ilgili alanlara gelir. Bir alanı değiştirmek yalnızca o anki aktarımı etkiler; profili kaydetmediğin sürece kalıcı profil değişmez.

## Profil oluşturma

Alanları doldurduktan sonra **Profili kaydet** seçeneğini kullan. Profil adı istenir. Aynı isimde profil varsa değerler güncellenir. Profil sayısı 24 ile sınırlıdır.

## Profil merkezi

Prompt Library içindeki Değişken profilleri alanı profilleri aramak ve sıralamak için kullanılır. Favori profiller önce gösterilir. Kopyalama yeni bir kimlik ve benzersiz bir ad oluşturur. Yeniden adlandırma duplicate isimleri reddeder. Silme onay ister.

## Ön ayarlar

Ön ayarlar, yeniden kullanılabilir değişken değerleri için daha hafif bir kayıt katmanıdır. Birden fazla prompt arasında ortak değer setlerini saklamak için kullanılabilir. Preset verileri profil verisinden ayrı tutulur.

## Öneriler

Bir profil favori olduğunda eşleşen değişken isimlerine sahip istemler öneriler alanında gösterilebilir. Sistem yalnızca isim eşleşmelerine göre skor üretir; saklanan değerleri öneri metnine yazmaz.

## Geçmiş

Son Smart Insert kullanımları ayrı bir geçmiş alanında tutulur. Geçmişte prompt body veya değişken değeri bulunmaz. İstem adı ve kullanım zamanı gösterilir. Tek kayıt kaldırılabilir veya tüm geçmiş onayla temizlenebilir.

## Yedekleme

Profilleri JSON olarak dışa aktar. Yedek dosyasını güvenli sakla. İçe aktarma sırasında aynı isimde profiller birleştirilir ve fazla kayıtlar 24 profil sınırına göre alınır.

## Aktarım davranışı

**Composer’a aktar** yalnızca sohbet mesaj alanını doldurur. Hafize otomatik olarak göndermeye başlamaz. Göndermek için normal Gönder düğmesine basmalısın. Bu ayrım, yanlış değerlerin kontrol edilmeden gönderilmesini önler.

## Kısayollar

Smart Insert hızlı açmak için Ctrl/Cmd+Shift+I, profil merkezine gitmek için Ctrl/Cmd+Shift+L, geçmişi göstermek/gizlemek için Ctrl/Cmd+Shift+H kullanılabilir. Metin alanında yazarken bu kısayollar engellenir.

## Hatalar

Bir değişken boş bırakılırsa aktarım yapılmaz ve ilk eksik alan odaklanır. Profil yedeği bozuksa mevcut veriler değiştirilmez. Büyük dosya reddedilir. Storage kullanılamıyorsa manuel doldurma akışı mümkün olduğunca korunur.

## Mobil

Mobil ekranda form alanları tek kolona geçer. Aksiyonlar dikey yerleşir. Profil ve geçmiş satırları dar ekrana göre yeniden akışa girer.

## Erişilebilirlik

Klavye ile tüm kontrollere ulaşılabilir. Dialog Escape ile kapanır. Focus görünürlüğü korunur. Forced-colors ve reduced-motion tercihleri desteklenir.

## Gizlilik

Smart Insert modülleri yeni bir backend entegrasyonu içermez. Profil, preset ve history local storage'da kalır. Dışa aktarma açık kullanıcı eylemiyle yerel dosya üretir.

## Sorun giderme

Prompt Library kartı görünüyorsa ancak Akıllı doldur düğmesi görünmüyorsa sayfayı yenile. Profil merkezi açılmıyorsa Prompt Library'nin kendisinin yüklendiğini kontrol et. Geçmiş boşsa daha önce Smart Insert ile aktarım yapılmış olması gerekir. Cache güncellemesi beklenmiyorsa service worker'ın yeni shell sürümünü aldığını kontrol et.
