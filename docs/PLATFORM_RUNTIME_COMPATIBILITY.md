# Platform Runtime Compatibility

| Capability | Destek yoksa | Kritik mi? |
| --- | --- | --- |
| localStorage | memory-only | Hayır |
| StorageManager | `null` estimate | Hayır |
| Service Worker | online app shell | Hayır |
| Speech Synthesis | metin yanıt | Hayır |
| Speech Recognition | klavye girişi | Hayır |
| Screen Capture | dosya/metin alternatifleri | Hayır |
| Clipboard | manuel kopyalama | Hayır |
| Trusted Types | textContent/DOM API | Hayır |
| PerformanceObserver | temel metric | Hayır |
| requestIdleCallback | timeout fallback | Hayır |

## Browser policy

Feature detection gerçek kullanım öncesinde yapılır. User-agent sniffing kullanılmaz.

## Offline policy

Network offline olduğunda remote API davranışı mevcut app runtime tarafından yönetilir. Platform runtime yalnızca durumu raporlar ve dashboard'a yansıtır.

## Private browsing

Storage API'leri hata verebilir. Exception'lar yutulur ve in-memory fallback korunur.

## Old browsers

ES2022 hedefi Vite output tarafından desteklenmeyen browser'larda polyfill garantisi vermez. Platform runtime feature detection ile progressive enhancement uygular.

## Tablet

Tablet genişlikleri desktop ve mobile kuralları arasında responsive olarak çalışır. Dashboard genişliği viewport sınırında tutulur.

## PWA installed mode

Installed PWA ve normal tab aynı local storage anahtarlarını kullanır; origin bazlı storage izolasyonu tarayıcı tarafından korunur.
