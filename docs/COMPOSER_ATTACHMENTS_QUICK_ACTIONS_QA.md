# Composer Ekleri — Quick Actions QA

## Actions
Özetle, Kod incele, Hata ara ve Gereksinime dönüştür ayrı instruction üretir.

## Selection
Yalnız selected attachment kayıtları payload'a girer. Range start/end korunur.

## Capacity
Instruction + payload toplamı composer ve 11.500 karakter sınırına sığmalıdır.

## Security
Riskli selected records explicit confirmation olmadan insert edilmez.

## No-submit
Quick action yalnız textarea'yı günceller ve input event'i yayınlar.

## Focus
Quick action tamamlandığında focus composer'a döner.

## Failure
Capacity veya user cancel durumunda composer eski değerini korur.