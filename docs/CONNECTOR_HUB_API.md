# Bağlantılar API sözleşmesi

## Sağlık endpoint'i

GET /api/health

Kullanılan alanlar:

- githubReadConfigured
- gmailReadConfigured
- canvaReadConfigured

Bu alanlar yapılandırma durumunu bildirir; kullanıcıya credential vermez.

## Gmail endpoint'i

GET /api/connectors/gmail/status

Beklenen başarılı gövde:

{ "linked": true | false }

Beklenen güvenli hata örnekleri:

- AUTH_REQUIRED
- GMAIL_NOT_CONFIGURED

## Canva endpoint'i

GET /api/connectors/canva/status

Beklenen başarılı gövde:

{ "linked": true | false }

Beklenen güvenli hata örnekleri:

- AUTH_REQUIRED
- CANVA_NOT_CONFIGURED

## HTTP davranışı

2xx yanıtlar JSON olarak okunur. Non-2xx durumda kullanıcıya yalnızca güvenli error kodu taşınır.

## Credential sınırı

Client tarafı:

- token istemez
- Authorization header üretmez
- connector owner kimliği tutmaz
- OAuth client secret tutmaz

## Timeout

Her istek sekiz saniyeyi aşarsa AbortController devreye girer. Timeout sonucu TIMEOUT durum kodudur.

## Retry

Panel otomatik agresif retry yapmaz. Kullanıcının yenileme eylemi bilinçli bir yeniden sorgudur.

## Rate control

900 ms'den kısa ardışık yenilemeler engellenir. Aynı anda ikinci refresh başlatılmaz.

## Sonuç birleştirme

Health, Gmail ve Canva sorguları Promise.all ile paralel yürür. Bir provider'ın hatası diğer provider'ın durumunu gizlemez.

## Uyum

Backend sözleşmesi değiştiğinde UI yeni alanlar ekleyebilir, fakat mevcut linked ve yapılandırma boolean'larının anlamını tersine çeviremez.

## Güvenli hata mesajı

Sunucu iç stack trace'i, provider response gövdesi veya credential değeri UI'a taşınmaz.

## Test beklentileri

API sözleşmesi testleri endpoint, method, same-origin credentials, timeout ve güvenli hata kodlarını doğrular.
