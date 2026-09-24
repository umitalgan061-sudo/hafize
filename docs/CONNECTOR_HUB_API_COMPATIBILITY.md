# Bağlantılar API uyumluluğu

## Health contract

Hub yalnız üç boolean alanı tüketir:

- githubReadConfigured
- gmailReadConfigured
- canvaReadConfigured

Ek health alanları hub tarafından yok sayılır.

## Gmail status

Hub linked alanını boolean olarak yorumlar.

Eksik linked değeri bağlı değil olarak kabul edilir.

## Canva status

Aynı linked kuralı geçerlidir.

## Error compatibility

Bilinmeyen error kodları genel hata akışına düşer.

AUTH_REQUIRED özel durumdur.

GMAIL_NOT_CONFIGURED ve CANVA_NOT_CONFIGURED özel durumdur.

## HTTP compatibility

Non-2xx response body JSON değilse UI status code'dan güvenli hata üretir.

## Response shape

Hub raw provider payload'ını başka bir API'ye forward etmez.

## Versioning

Endpoint yollarında versiyon numarası bulunmadığı için UI sabit alan adlarını korumalıdır.

## Auth compatibility

Hub mevcut browser session cookie mekanizmasına güvenir.

Connector auth token client'a taşınmaz.

## Write compatibility

Endpoint'ler read-only status yüzeyidir. Backend write route'ları hub tarafından çağrılmaz.

## Future field additions

Yeni alanlar additive olabilir.

Alan kaldırma veya semantiğini tersine çevirme ayrı migration gerektirir.

## Error fallback

UI feature failure application shell failure'ına dönüşmemelidir.

## Test

Uyumluluk testi mevcut endpoint path'lerini, güvenli method'u ve kabul edilen alanları doğrular.
