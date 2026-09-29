# Konuşma Dalları Değişiklik Günlüğü

## v1
İlk yerel fork akışı eklendi.

### UI
Mesaj bazlı dallandırma eylemi, onay dialogu ve sidebar çocuk dal listesi eklendi.

### Veri
forkOf, forkMessageId ve forkDepth alanları opsiyonel metadata olarak tanımlandı.

### Keyboard
Ctrl / Cmd + Shift + F son mesajdan fork başlatır.

### Runtime
App shell custom open-conversation olayını dinler. Streaming sırasında fork engellenir.

### PWA
Fork CSS ve typed entry service worker shell listesine alındı.

### Build
Vite development transform zincirindeki hatalı statement sonlandırması düzeltildi; yeni fork typed entrypoint'i doğru zincire dahil edildi.
