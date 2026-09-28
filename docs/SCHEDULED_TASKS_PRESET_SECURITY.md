# Preset Güvenlik Notları

## Güven modeli
Preset verisi güvenilir kabul edilmez.
Import edilen her kayıt normalize edilir.
Unknown fields ignored edilir.

## XSS
Başlık ve görev metni textContent ile çizilir.
Preset values innerHTML ile HTML olarak birleştirilmez.
Dataset yalnız ID gibi sınırlı teknik değerler için kullanılır.

## JSON
Yalnız 256 KB dosya okunur.
Array veya object.items şekli desteklenir.
Parser failure mevcut storage'ı overwrite etmez.

## ID
Import edilen ID'ler yalnız local record kimliği olarak kullanılır.
Server scheduleId yerine geçmez.

## Storage
Preset anahtarı schedule API ile paylaşılmaz.
Service worker storage içeriğini değil yalnız asset dosyasını cache'ler.

## Clipboard ve export
Export dosyası local Blob'tur.
Harici endpoint'e fetch/XHR gönderilmez.
Preset değerleri analytics'e gönderilmez.

## Consent
Preset kullanımı server create çağrısı değildir.
Gerçek schedule POST'u kullanıcı form submit'i ile gerçekleşir.

## Privacy
Preset retention kullanıcı clear/storage kontrolüne bağlıdır.
Dosya export'u cihaz dışında yalnız kullanıcı seçerse gerçekleşir.
