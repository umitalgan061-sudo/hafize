# Prompt Library import veri modeli

## Kaynak biçimleri
Eski sürümde doğrudan dizi kabul edilir. Yeni biçimde version, source, exportedAt ve items alanları kabul edilir.

## Normalize edilmiş kayıt
Her prompt id, title, body, tags, variables, favorite, useCount, createdAt ve updatedAt alanlarından oluşur.

## Import planı
Plan; currentCount, sourceCount, validCount, invalidCount, duplicateIds, collisions, acceptedCount ve capacitySkipped alanlarını taşır.

## Meta
source ve exportedAt yalnızca bilgi amaçlıdır; çalışma zamanı davranışını değiştirmez.

## Uyum
Bilinmeyen üst seviye alanlar yok sayılır. Bilinmeyen prompt alanları normalize edilmiş modelde tutulmaz.

## Boyut
Import raw payload için 1 MB dosya sınırı vardır. Prompt başına body limiti ana modelde 8000 karakterdir.

## Migration
Yeni import katmanı mevcut storage anahtarını değiştirmez.
