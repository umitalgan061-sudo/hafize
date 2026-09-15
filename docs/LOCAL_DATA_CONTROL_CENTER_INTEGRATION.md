# Yerel Veri Merkezi — Settings Entegrasyonu

Data center, Settings Workspace'in altında ayrı bir panel olarak mount edilir. Settings paneli yoksa modül sessizce çıkış yapar.

## Mount sırası

Settings workspace oluşturulduktan sonra data center script'i çalışır. Alt insights, filters, audit, bulk ve sort modülleri merkez DOM'unu gözlemleyerek kendi yüzeylerini kurar.

## Duplicate koruması

Ana panel `localDataCenter` id'siyle tekil mount edilir. Her alt controller de kendi id'sini kontrol eder.

## Failure isolation

Her yardımcı modül data center veya API mevcut değilse mount olmaz. Bir yardımcı modülün başarısız olması diğer Settings alanlarını kapatmamalıdır.

## Event modeli

Storage events snapshot yenilemesini tetikler. UI filtreleri ve sıralama yalnız DOM visibility/order değiştirir.

## PWA

Static asset'ler service-worker shell policy ile eşlenir.

## Rollback

Alt modül kaldırılırsa ana data center çalışmaya devam edebilir. Ana panel kaldırılırsa alt modüller null guard ile çıkış yapar.
