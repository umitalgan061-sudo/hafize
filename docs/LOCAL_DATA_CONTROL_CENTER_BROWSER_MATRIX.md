# Yerel Veri Merkezi — Tarayıcı Matrisi

## Chromium

`localStorage`, `TextEncoder`, `Blob` ve Object URL yolları desteklenir. Native buttons ve focus-visible mevcut shell stilleriyle çalışmalıdır.

## Firefox

Storage exception handling aynı fail-soft sözleşmesine uyar. JSON parse hatası yalnız ilgili store snapshot'ını etkiler.

## Safari

Private browsing ve quota davranışı farklı olabilir. `safeStorage` erişimi exception ürettiğinde chat bozulmamalıdır.

## Mobile Safari

Dar viewport'ta action stack dikeyleşir. Touch kullanıcısı silme ve refresh kontrollerine ulaşabilmelidir.

## Android browsers

Reduced-width layout korunur. Storage event cross-tab veya installed PWA context'te değiştiğinde summary yenilenebilir.

## Keyboard

Tab native sırasını izler. Kısayol yalnız explicit modifier kombinasyonu ile çalışır; textarea submitine yönlenmez.

## PWA

CSS/JS shell cache'de bulunur. Install sonrası local storage verisi browser origin içinde kalır.

## Unsupported APIs

TextEncoder unavailable ise bounded fallback kullanılır. Blob/Object URL unavailable ise manifest export başarısızlık state'inde kalır.
