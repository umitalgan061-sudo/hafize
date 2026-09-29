# Model ve Ajan Tercihleri Veri Modeli

## State

State sürümü 1 aşağıdaki alanları taşır:

- version
- selectedModel
- selectedAgentId
- profiles
- updatedAt

## Profile

Her profil aşağıdaki alanları taşır:

- id
- name
- model
- agentId
- toolsEnabled
- useCount
- createdAt
- updatedAt

## Normalizasyon

Okuma sınırında tüm payload tekrar normalize edilir.
Dizi olmayan profil alanları reddedilir.
Boş model veya ajan kimliği olan profil geçersizdir.
Kimliği olmayan geçerli profile yeni yerel ID atanır.
Negatif veya sonlu olmayan kullanım sayaçları sıfıra çekilir.
Kullanım sayacı 9999 üstünde saklanmaz.
İsim ve kimlik alanları üst sınırdan kesilir.

## Sıralama

Profil listesi aktif model ve ajan kombinasyonunu öne alır.
Eşit aktiflikte kullanım sayısı yüksek profil öne gelir.
Son eşitlik kırıcı güncelleme zamanıdır.
Bu sıra yalnız UI kolaylığıdır; güvenlik veya yetki kararı değildir.

## Import

Import edilen profil önce normalize edilir.
Mevcut ID ile çakışırsa yeni ID üretilir.
Geçersiz kayıtlar rejected sayacına eklenir.
Kapasite dolana kadar en fazla altı geçerli profil saklanır.
Array ve profiles alanlı nesne biçimleri desteklenir.

## Export

Export payload version, source, exportedAt, selectedModel, selectedAgentId ve profiles alanlarını içerir.
Payload JSON olarak üretilir.
Boyut sınırı aşılırsa profil kümesi kontrollü biçimde küçültülür.
Export sırasında konuşma mesajları veya secret alanları dahil edilmez.

## Yaşam döngüsü

İlk açılışta güvenli boş state kullanılır.
Model veya ajan seçimi değişince seçim state'i güncellenir.
Profil uygulanınca kullanım sayısı artar.
Profil silinince diğer profiller korunur.
Sıfırlama yalnız kendi storage anahtarını temizler.

## Invariantlar

Profil sayısı 6'dan büyük olmamalıdır.
Profil ID'leri benzersiz olmalıdır.
Geçerli profil model ve ajan kimliği içermelidir.
useCount negatif olmamalıdır.
Storage bozuksa uygulama açılmaya devam etmelidir.
