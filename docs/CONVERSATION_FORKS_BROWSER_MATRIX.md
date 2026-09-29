# Konuşma Dalları Tarayıcı Matrisi

## Chromium
- localStorage okuma/yazma.
- MutationObserver ile mesaj eylemi enjeksiyonu.
- CustomEvent ile conversation geçişi.
- Clipboard veya download kullanılmadan temel fork akışı çalışır.

## Firefox
- CSS forced-colors ve focus görünürlüğü korunur.
- Optional chaining ve Array.from gibi mevcut proje hedefleriyle uyumludur.

## Safari
- crypto.randomUUID yoksa fallback ID üretimi kullanılır.
- localStorage hatası fork işlemini güvenli şekilde durdurur.

## PWA
- Service worker shell cache fork CSS ve typed-build fork entrypoint'i içerir.
- API cevapları fork tarafından cache'lenmez.
- Fork state mevcut conversation storage'ından gelir.
