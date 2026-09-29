# Model ve Ajan Tercihleri Hata Modları

| Durum | Davranış | Veri etkisi |
|---|---|---|
| Storage okunamıyor | Boş state | Yok |
| Storage yazılamıyor | false sonucu | Mevcut veri korunur |
| Bozuk JSON | Boş state | Backend verisi etkilenmez |
| Model listesi boş | Seçim uygulanmaz | Profil korunur |
| Ajan listesi boş | Seçim uygulanmaz | Profil korunur |
| Profil modeli yok | Uygulanmaz | Profil silinmez |
| Profil ajanı yok | Uygulanmaz | Profil silinmez |
| Streaming sırasında apply | Reddedilir | Sohbet korunur |
| Büyük import | Dosya reddedilir | State değişmez |
| Geçersiz import | Kayıt reddedilir | Geçerli kayıtlar korunur |
| ID collision | Yeni ID | Eski profil korunur |
| Profil limiti | Yeni kayıt alınmaz | Altı profil korunur |
| Export URL revoke | Geçici URL temizlenir | Storage etkilenmez |

## Güvenli varsayılanlar

Geçersiz seçim zorla uygulanmaz.
Import hatası mevcut state'i boşaltmaz.
Silme işlemleri açık onay ister.
Network hatası tercih panelinin yerel verisini silmez.

## Destek yaklaşımı

Hata mesajı kısa tutulur.
Secret veya kullanıcı mesajı toast içine yazılmaz.
Kullanıcıdan önce JSON yedeği alınması önerilir.
Kalıcı veri kaybı beklenmez; reset yalnız explicit kullanıcı eylemidir.
