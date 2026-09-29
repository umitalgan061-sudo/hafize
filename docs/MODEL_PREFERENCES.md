# Model ve Ajan Tercihleri

## Amaç

Model ve ajan seçimini sohbetler arasında cihaz üzerinde hatırlamak ve sık kullanılan model, ajan ve araç kombinasyonlarını profil olarak saklamak.

## Kapsam

Bu özellik yalnızca tarayıcı istemcisindeki seçim deneyimini düzenler.
Sunucuya yeni endpoint eklemez.
Model veya ajan yetkisi üretmez.
Mevcut sohbetin agentId ve toolsEnabled alanlarını değiştirmek dışında konuşma verisini değiştirmez.

## Temel akış

1. Model listesi /api/models üzerinden yüklenir.
2. Ajan listesi /api/agents üzerinden yüklenir.
3. Kullanıcının son seçimi hafize.model-preferences.v1 anahtarından geri yüklenir.
4. Kullanıcı mevcut kombinasyonu profil olarak kaydeder.
5. Profil Uygula ile aktif sohbete uygulanır.
6. Profil kullanımı sayaçla izlenir ve sık kullanılan profiller üstte görünür.
7. Kullanıcı tercihleri JSON olarak dışa aktarabilir veya geri yükleyebilir.

## Profil alanları

id benzersiz yerel kimliktir.
name kullanıcıya görünen profil adıdır.
model NVIDIA model kimliğidir.
agentId Hafize ajan kimliğidir.
toolsEnabled araç modunun profil içindeki tercihidir.
useCount profilin uygulanma sayısıdır.
createdAt ve updatedAt denetim zamanlarıdır.

## Sınırlar

Profil sayısı altı ile sınırlıdır.
Profil adı 48 karakterdir.
Model kimliği 180 karakterdir.
Ajan kimliği 140 karakterdir.
Import dosyası 200 KB ile sınırlıdır.
Export çıktısı 200 KB ile sınırlandırılır.

## Güvenlik ilkeleri

Profil verileri cihazdan dışarı gönderilmez.
Secret, token ve OAuth bilgisini saklayan özel alan bulunmaz.
Import önce normalize edilir.
Geçersiz kayıtlar reddedilir.
ID çakışmaları mevcut profilin üzerine yazmak yerine yeni kimlik üretir.

## UI ilkeleri

Tercihler paneli dialog semantiği kullanır.
Kapatma sonrası odak paneli açan düğmeye döner.
Escape paneli kapatır.
Tab dolaşımı panel içinde kalır.
Ctrl veya Command + Shift + M paneli açıp kapatır.
Kısayol form elemanlarında bilinçli olarak devre dışıdır.

## Uygulama sınırı

Profil uygulama hiçbir zaman composer submit etmez.
Profil seçimi yeni sohbet oluşturmak için ağ isteği başlatmaz.
Profil değişikliği mevcut backend auth, model doğrulaması veya agent ownership kontrollerini değiştirmez.
