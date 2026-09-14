# Smart Fill Hata ve Fallback Matrisi

| Durum | Beklenen davranış | Veri kaybı |
|---|---|---|
| Prompt Library bulunamadı | Smart Fill mount olmaz | Yok |
| İstem bulunamadı | Panel açılmaz | Yok |
| Değişken yok | Doğrudan aktarım korunur | Yok |
| Bozuk preset JSON | Boş preset listesi | Yok |
| localStorage okuma hatası | Boş preset listesi | Mevcut kütüphane etkilenmez |
| localStorage yazma hatası | Hata mesajı | Yeni preset kalıcı olmayabilir |
| Boş değişken | Aktarım engellenir | Yok |
| Değer 1000+ karakter | Input ve çıktı kesilir | Kontrollü |
| 13+ değişken | İlk 12 işlenir | Kontrollü |
| 8000+ çıktı | Çıktı sınırlandırılır | Kontrollü |
| Clipboard yok | Hata mesajı | Yok |
| Escape | Panel kapanır, form atılır | Yok |
| Destroy | Listener ve DOM temizlenir | Yok |
| PWA eski cache | v28 shell cache devreye girer | Yok |

## İyileştirme ilkeleri

Hata durumunda kullanıcıya sessiz başarısızlık yerine kısa bir durum mesajı verilir. Kritik olmayan storage hataları uygulama shell'ini durdurmaz.

Önizleme ile composer aktarımı arasında backend çağrısı bulunmadığı için ağ hataları bu akışın parçası değildir.

## Bozuk kayıtlar

Preset alanı dışarıdan değiştirilmiş olabilir. Kod yalnızca nesne tipindeki kayıtları kabul eder; isim/id zorunluluğu olmayan kayıtları eler. Değerler tekrar sınırlandırılır.

## Event hataları

Panel mevcut `Kullan` olayının önüne geçmek için capture phase kullanır. Yalnızca değişkenli istemlerde propagation durdurulur; değişkensiz istemler eski davranışı kullanmaya devam eder.

## PWA fallback

Service worker shell listesinde Smart Fill asset'leri yer alır. Asset yoksa service worker request'i navigation/shell kurallarına göre ele alır; API çağrıları network-only kalır.
