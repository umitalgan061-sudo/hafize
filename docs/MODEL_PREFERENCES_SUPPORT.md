# Model ve Ajan Tercihleri Destek Rehberi

## Kullanıcı seçimi kayboldu

Model listesinin yüklenmiş olduğunu kontrol et.
Aynı model kimliğinin yeni sürümde mevcut olup olmadığını kontrol et.
Storage erişiminin tarayıcı tarafından engellenmediğini kontrol et.

## Profil uygulanamıyor

Profilin model ve ajan kimliklerini kontrol et.
Ajan listesi değişmiş olabilir.
Yanıt üretimi sürerken Apply bilinçli olarak engellenir.

## Profil silinemiyor

Kullanıcı onayının verildiğini kontrol et.
Storage yazımı başarısızsa mevcut kayıt korunabilir.
JSON yedeği varsa import ile geri dönüş yapılabilir.

## Import çalışmıyor

Dosya boyutu 200 KB altında olmalıdır.
JSON geçerli olmalıdır.
Profil içinde model ve agentId bulunmalıdır.
Altı profil kapasitesi dolu olabilir.

## Export çalışmıyor

Tarayıcının Blob ve object URL desteğini kontrol et.
Dosya indirme politikası tarafından engelleniyor olabilir.
State storage erişilemez olsa da export mevcut state snapshot'ından üretilebilir.

## Hata raporu

Kullanıcıdan secret veya access token istenmemelidir.
Gerekli minimum bilgi: tarayıcı, adım, hata mesajı ve mümkünse profil export'u.
Export dosyası paylaşılmadan önce kullanıcıya içeriğini incelemesi söylenmelidir.
