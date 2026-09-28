# Yanıt Regeneration Performans

## Hedef
Regeneration mevcut stream hızını değiştirmeden yeni yanıtı aynı SSE kanalı üzerinden göstermek.

## Memory
En fazla üç alternate ve sınırlı generation metadata tutulur. Büyük ayrı bir index oluşturulmaz.

## Render
Streaming sırasında yalnız mevcut message content güncellenir. Final state render ile eylemler tekrar oluşturulur.

## Storage
Regeneration başarı ve restore sonrasında bounded JSON write yapar. Ek analytics write yoktur.

## UI
Action row küçük DOM yüzeyidir. Uzun yanıtlar CSS ile overflow-wrap edilir.

## Timer
Yeni background timer kullanılmaz.

## PWA
Yeni data asset'i service worker shell cache'e eklenmez.

## Failure cost
Başarısız regeneration eski yanıtı memory'den geri koyar; ekstra recovery snapshot üretmez.

## Kabul
- duplicate render gözlenmez
- alternate listesi bounded
- stream sırasında composer disabled
- restore sonrası tek render cycle
