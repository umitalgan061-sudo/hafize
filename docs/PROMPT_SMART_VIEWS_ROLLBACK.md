# Akıllı Görünümler Rollback

## Kod rollback

PR revert edildiğinde Prompt Library ana kayıt alanı korunur.
Smart View storage anahtarı ayrı olduğu için temel istemler silinmez.

## Storage rollback

Görünüm anahtarı:
`hafize.prompt-library.smart-views.v1`

History anahtarı:
`hafize.prompt-library.smart-views-history.v1`

Repair checkpoint:
`hafize.prompt-library.smart-views.v1.repair-checkpoint`

Bu anahtarların silinmesi yalnız akıllı görünümleri etkiler.

## PWA rollback

Service worker shell cache sürümü önceki numaraya döndürülebilir.
Prompt Library core asset'leri API cache politikasına alınmamalıdır.

## Kullanıcı verisi

Görünüm rollback'i prompt body kayıtlarını geri almaz.
Onarım rollback'i yalnız checkpoint'teki görünüm listesini geri yükler.
Kullanıcının manuel export yedeği bağımsızdır.