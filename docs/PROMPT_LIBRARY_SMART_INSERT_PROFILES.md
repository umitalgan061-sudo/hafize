# Smart Insert — Profil Sistemi

## Amaç

Değişkenli istemlerde tekrar kullanılan bağlamları cihaz üzerinde yeniden kullanabilmek için profil sistemi sunulur. Profil yalnızca değişken adı/değeri eşleşmelerini, profil adını, favori bilgisini ve güncelleme zamanını taşır.

## Veri sınırları

En fazla 24 profil tutulur. Profil adı 60 karakter, değişken adı 32 karakter, değişken değeri 1000 karakterdir. Bir profilde en fazla 12 değişken bulunur. Gelen veri her yazma ve içe aktarma işleminde normalize edilir.

## İsim çakışması

Profil isimleri Türkçe locale ile büyük/küçük harf duyarsız değerlendirilir. Yeni kayıt aynı isimde mevcut profil varsa yeni kayıt oluşturmak yerine mevcut profilin değerlerini günceller. İçe aktarma mevcut kimliği korur.

## Favoriler

Favori alanı profil seçimini hızlandırır. Merkez görünümünde favoriler önce gösterilir; bu bir sıralama kolaylığıdır ve veri değerlerini değiştirmez.

## Güvenli yazma

Değerler NUL karakterlerinden arındırılır ve uzunluk sınırına göre kesilir. Nesne anahtarları yalnızca alfasayısal karakter, `_` ve `-` ile normalize edilir. Böylece profil verisi UI koduna veya CSS/HTML olarak yorumlanmaz.

## İçe aktarma

JSON dosyasının tamamı 300 KB ile sınırlandırılır. Dizi veya `{ profiles: [...] }` biçimi kabul edilir. Geçersiz kayıtlar atlanır; mevcut kayıtlar isim üzerinden birleştirilir; yeni kayıtlar kapasite dolana kadar eklenir.

## Dışa aktarma

Dışa aktarma yerel tarayıcı indirmesi oluşturur. Dosya kaynağı `hafize-prompt-variable-profiles` olarak işaretlenir ve sürüm numarası taşır. Sunucuya upload yapılmaz.

## Kurtarma

Local storage okunamazsa boş profil listesi döndürülür. Yazma başarısızsa kullanıcıya durum mesajı verilir ve mevcut uygulama akışı bozulmaz. Profil dosyası silinse bile Prompt Library içindeki istem kayıtları etkilenmez.

## Ürün sözleşmesi

Profil seçimi Smart Insert modalındaki alanları doldurur; modal kapatıldığında değerler otomatik olarak sohbet geçmişine yazılmaz. Composer aktarımı yalnızca kullanıcı eylemiyle gerçekleşir.

## Test beklentileri

`normalizeProfile` ve `normalizeProfiles` sınır testlerinden geçmelidir. Import/merge testleri çakışan isim, çift kimlik, kapasite doluluğu ve bozuk JSON durumlarını kapsamalıdır. UI testleri profil merkezi arama, favorileme, yeniden adlandırma, silme ve dışa aktarma düğmelerinin varlığını kontrol etmelidir.
