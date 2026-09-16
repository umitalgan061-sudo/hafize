# Collections + Revisions support guide

## Scope

Destek ekibi yalnızca feature davranışını teşhis eder; kullanıcıdan prompt gövdesi, token veya connector secret istenmez.

## Collection issues

Koleksiyon görünmüyorsa Prompt Library kartının mount durumunu kontrol et. Liste boşsa storage anahtarının okunup okunamadığına bak. Invalid JSON failure-safe boş listeye dönüşebilir.

Koleksiyon üyeliği yanlışsa hedef koleksiyon, seçili prompt id'leri ve orphan pruning kontrol edilir. Prompt silme koleksiyondan ayrı bir işlemdir.

## Revision issues

Geçmiş boşsa ilgili prompt'un id'sini ve revision storage erişimini kontrol et. Aynı içerikte yeni revision oluşmaması beklenen davranıştır.

Restore çalışmıyorsa prompt veya revision artık mevcut olmayabilir. Restore işlemi öncesi confirmation gerekir.

## Data safety

Normal destek akışında storage temizleme önerilmez. Önce ilgili feature'ın isolation boundary'si kontrol edilir.

## PWA issues

Yeni assets görünmüyorsa service worker cache version ve shell listesi kontrol edilir. API yanıtlarının cache'te olması beklenmez.

## Compatibility

Feature mevcut Prompt Library ana kaydını değiştirmez. Collection ve revision anahtarları silinse bile temel prompt deneyimi çalışabilmelidir.

## Escalation evidence

Feature adı, tarayıcı, yaklaşık kayıt sayısı, işlem tipi, hata mesajı ve storage erişimi yeterlidir. Hassas prompt içeriği paylaşılmamalıdır.

## Recovery

UI rollback veri sıfırlaması değildir. İlgili entry geri alınırken yeni storage key'leri korunabilir.
