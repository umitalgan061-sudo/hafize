# Prompt Smart Fill — Merge Ready

Bu turdaki ana geliştirme, yerel Prompt Library içindeki değişkenli istemlerin (`{{degisken}}`) daha kontrollü ve erişilebilir biçimde doldurulmasıdır.

## Kapsam

- Değişken alanlarını ayrı bir doldurma yüzeyinde yönetir.
- Canlı önizleme ile son istem metnini gösterir.
- Boş/değer sınırı kontrollerini istem istemi doldurma akışına uygular.
- Doldurma işlemi yalnızca sohbet composer alanını günceller; otomatik gönderim yapmaz.
- Storage verisini backend'e veya telemetriye taşımaz.
- PWA shell asset listesine gerekli istem yüzeylerini ekler.

## Merge gate

- Tur base'i: `998547ddc63e8b3a62ad74c3ed49614df62620d4`
- Base → head diff: 2.446 değişen satır.
- Üst sınır: 3.000 değişen satır.
- Durum: sınır içinde ve yaklaşık hedef bantta.
- Geri alma: ilgili PR revert'i ile Smart Fill yüzeyi geri alınabilir.
