# Bağlantılar tarayıcı matrisi

## Chromium

Beklenen:

- native fetch
- AbortController
- sessionStorage
- Intl.DateTimeFormat
- DOM event listeners

## Firefox

Aynı standart API'ler kullanılır. Connector state browser-specific API'ye dayanmaz.

## Safari

Fetch credentials, sessionStorage ve AbortController standart yollarla kullanılmalıdır. UI provider kartlarını native DOM olarak üretir.

## Mobile Safari

Status rows tek kolona düşer. Refresh button erişilebilir kalır.

## Mobile Chromium

Aynı davranış.

## PWA standalone

Service worker shell asset'leri içerdiğinde hub offline shell içinde çizilebilir. API status çağrıları online olduğunda yenilenir.

## Offline

Health ve provider status network-only olduğu için son canlı durum yerine hata/okunamıyor mesajı gösterilebilir. Eski connector response cache'lenmez.

## Reduced motion

Ek animasyon yoktur.

## Forced colors

Border ve focus sistem renkleriyle görünür.

## Storage disabled

SessionStorage exception durumunda panel çalışmaya devam eder.

## Fetch disabled

Test ortamı FETCH_UNAVAILABLE fallback'ini kullanır.

## Acceptance

Tarayıcı matrisi product capability değil, yalnız standart API davranışı ve layout sözleşmesidir.
