# Composer Ekleri — Performans

## Bounded çalışma
Öncelik sırası: byte validation → dosya okuma → normalize → binary sezgisi → toplam queue kontrolü → render.

Dosyalar sırayla okunur. Her dosya için bağımsız hata raporlanır.

## Limitler

- 4 eşzamanlı dosya
- 256 KB tek dosya
- 80.000 karakter tek içerik
- 200.000 karakter queue
- 400 satır tek range
- 11.500 karakter tek insert
- 12 satır preview

## Memory
Dosya içeriği localStorage'a yazılmaz. Tek timer ile staged memory 15 dakika sonra temizlenir.

Büyük dosya byte sınırı geçiyorsa File API read başlamadan reddedilir. Bu özellikle binary veya generated file kaynaklı gereksiz bellek baskısını azaltır.

## DOM
Liste replaceChildren ile çizilir. Her satırın eski listener'ları DOM düştüğünde erişilemez olur. destroy tüm üst seviye listener ve timer'ları kaldırır.

## Composer
Insert öncesinde composer maxlength ve mevcut metin uzunluğu birlikte değerlendirilir. Yeterli kapasite yoksa kısmi yazma yapılmaz.

## Render
Preview yalnız ilk 12 satırı görünür kılar. Range seçimi gerçek insert payload'una uygulanır; dosyanın geri kalanının kopyalanması gerekmez.

## Mobil
Panel maksimum yükseklik ve iki kolonlu responsive satır düzeni kullanır. Range inputları native number kontrolü olarak kalır.

## Performans regresyonu
Yeni özellikler dosya sayısı, byte veya karakter sınırlarını artırmak için kendi başına değişiklik yapmamalıdır.