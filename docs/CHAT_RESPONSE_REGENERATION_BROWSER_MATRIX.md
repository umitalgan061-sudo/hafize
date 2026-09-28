# Yanıt Regeneration Tarayıcı Matrisi

## Chromium
Butonlar, Clipboard API ve SSE akışı desteklenir. Clipboard reddedilirse fallback toast gösterilir.

## Firefox
SSE ve localStorage akışı korunur. Clipboard izni kapalıysa yalnız kopyalama eylemi etkilenir.

## Safari
Streaming davranışı mevcut fetch stream desteğine bağlıdır. Yeni feature service worker API'lerine özel bir bağımlılık eklemez.

## Mobil
Action row wrap olur. Composer kilitlenmesi ekranı taşırmaz.

## PWA
Yanıt verisi shell cache içine alınmaz. PWA yalnız static assetleri cachelemeye devam eder.

## Offline
Offline durumda yeni generation başlatılmaz; mevcut sohbet okunabilir.

## Forced colors
Action button border ve focus stilleri mevcut high-contrast politikasına uyar.

## Reduced motion
Yeni animasyon yoktur.

## Test
Browser matrix manuel smoke ile doğrulanır; source-contract testleri DOM ve network sınırlarını doğrular.
