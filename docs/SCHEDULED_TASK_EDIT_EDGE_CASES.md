# Schedule Edit Edge Cases

- Görev zamanı tam şu anda ise backend future-time kuralıyla reddeder.
- Browser timezone dönüşümü ISO değer üretir; server yine parse eder.
- Aynı update iki kez gönderilirse ikinci update güncel state üzerinden değerlendirilir.
- Max attempts düşürülerek mevcut attempts altına inilemez.
- Unknown field update'i reddedilir.
- Empty object update'i reddedilir.
- Running task UI'dan seçilemez.
- Liste refresh sırasında artık mevcut olmayan edit target formdan çıkarılır.
- Bulk selection refresh sırasında yalnız hâlâ scheduled kayıtlarla kesiştirilir.
- Persistence save failure state'i commit etmez.
