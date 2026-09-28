# Yanıt Yeniden Üretme QA

## Fonksiyonel
- Son assistant mesajında Yeniden üret görünür.
- Eski assistant mesajları disabled olur.
- Başarılı stream sonrası alternatif sayısı artar.
- Restore en son alternatifi geri getirir.
- Üç alternatiften fazlası tutulmaz.
- Copy aktif yanıtı kopyalar.

## Hata
- API 4xx ve 5xx eski yanıtı korur.
- Network error eski yanıtı korur.
- SSE hatası eski yanıtı korur.
- Boş sonuç eski yanıtı korur.
- Tool endpoint hatası eski yanıtı korur.

## Tool mode
Kapalı mod chat endpoint, açık mod agent endpoint kullanır.

## Feedback
Positive ve negative karşılıklı seçilebilir. Aynı seçim tekrar tıklanınca kaldırılır. Streaming sırasında disabled olur.

## Legacy
Alternates ve generation alanı olmayan eski konuşmalar açılabilir.

## UI
Mobil wrap, focus-visible, forced-colors ve reduced-motion kontrolleri korunur.

## Persistence
Başarılı regeneration, restore ve feedback değişiklikleri local conversation kaydını günceller.

## No submit
Hiçbir yanıt eylemi composer formunu otomatik göndermez.
