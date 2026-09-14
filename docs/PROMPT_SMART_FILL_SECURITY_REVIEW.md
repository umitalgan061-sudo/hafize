# Smart Fill Güvenlik İncelemesi

## Input

- [x] Değerler length-bounded.
- [x] Değişken sayısı bounded.
- [x] Preset sayısı bounded.
- [x] Query bounded.

## Output

- [x] Preview text-only.
- [x] Composer value-only.
- [x] No HTML interpolation.
- [x] No automatic submit.

## Storage

- [x] Ayrı Smart Fill namespace.
- [x] Safe JSON parse.
- [x] Write failure fallback.
- [x] Preset export dışı.

## Network

- [x] No fetch.
- [x] No XHR.
- [x] No WebSocket.
- [x] No sendBeacon.

## Lifecycle

- [x] Mount guard.
- [x] Escape close.
- [x] Focus return.
- [x] Event cleanup.
- [x] Observer cleanup.

## PWA

- [x] v29 shell.
- [x] All feature assets cached.
- [x] API paths remain network-only.

## Residual risk

LocalStorage, aynı cihazı kullanan başka kullanıcılar tarafından okunabilir. Bu uygulama düzeyi cihaz riski feature'ın server-side auth modelinden farklıdır.
