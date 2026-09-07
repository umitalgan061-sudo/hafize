# UI state contract

UI yüzeyi için ortak state vocabulary tanımlandı: `idle`, `loading`, `success`, `empty`, `error`, `offline`. `buildUiState()` aynı veri/uygulama koşulunda aynı state'i üretir.

Error ve offline durumları retryable işaretlenir. Loading'den doğrudan idle'a dönmek reddedilir; success/empty/error/offline terminal yüzeyler olarak ele alınır.

Bu contract görsel tasarımı belirlemez; app.js ve UI testlerinde ortak davranış dili sağlar.
