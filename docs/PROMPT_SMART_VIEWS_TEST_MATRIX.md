# Akıllı Görünümler Test Matrisi

## Veri

| Alan | Kontrol |
| --- | --- |
| id | normalize edilir ve duplicate ayrıştırılır |
| name | boş değer reddedilir |
| query | 180 karakterle sınırlıdır |
| min/max use | 0–9999 aralığında tutulur |
| capacity | 24 görünüm |
| history | 20 kayıt |

## Sorgu

Normal metin aranır.
tag: filtresi uygulanır.
-tag: hariç tutma uygulanır.
is:favorite uygulanır.
is:not-favorite uygulanır.
has:variable uygulanır.
has:no-variable uygulanır.
used karşılaştırmaları uygulanır.
Birden çok koşul birlikte uygulanır.

## UI

Panel mount olur.
Listeler semantik role taşır.
aria-expanded görünürlükle eşleşir.
Status live region güncellenir.
Mobil toolbar tek sütuna iner.
Forced-colors stilleri yüklenir.
Reduced motion davranışı korunur.

## Storage

Bozuk JSON boş güvenli duruma döner.
İçe aktarma mevcut kayıtları bozmadan merge eder.
Aynı ad çakışması atlanır.
Checkpoint onarım öncesi oluşturulur.
Geri alma checkpoint'i tüketir.

## PWA

Smart Views asset'leri shell cache'tedir.
Cache sürümü artmıştır.
API istekleri network-only kalır.

## Regression

Ana Prompt Library akışları Smart Views olmadan çalışmaya devam eder.
Görünüm uygulamak submit çağrısı yapmaz.
History yalnız yerel metadata tutar.
Builder yalnız composer filtreleme/arama yüzeyini etkiler.