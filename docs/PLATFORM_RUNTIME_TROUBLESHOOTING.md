# Platform Runtime Troubleshooting

## Sistem paneli görünmüyor

Kontrol edilecekler:

- typed `app-runtime` bundle yüklenmiş mi,
- platform runtime global'i oluşmuş mu,
- topbar DOM'u mevcut mu,
- browser console'da module import hatası var mı.

## Sistem sürekli Sınırlı

Önce `network`, sonra `errors`, sonra failed feature listesini kontrol et. Offline ise bu sonuç beklenebilir. Online durumda runtime health ile platform runtime durumunu birbirinden ayır.

## Performans metrikleri yok

PerformanceObserver desteklenmiyor olabilir. Dashboard yine çalışmalı. Fallback metric yalnızca platform self-check sinyalidir.

## Storage alanları boş

`navigator.storage.estimate` bazı browser'larda yoktur veya private mode altında hata verebilir. `null` değer hata değildir.

## Task queue reddediyor

`PLATFORM_TASK_QUEUE_FULL` queue kapasitesinin aşıldığını gösterir. Önce tamamlanan task'ları prune et, sonra task yaşam döngüsünün leak üretmediğini kontrol et.

## Task timeout

Timeout otomatik cancel sebebidir. Uzun işlerin abort signal'ını dinlediğinden emin ol.

## Diagnostics JSON boyutu büyük

Runtime yalnızca 20 son metriği paketler ve 120 KB sınırı uygular. Sınır aşılırsa minimal truncated belge üretilir.

## Secret sızıntısı şüphesi

Diagnostic belgeyi paylaşmadan önce `message`, cookie, auth token ve environment değerlerinin bulunmadığını kontrol et. Error boundary zaten yaygın secret biçimlerini redakte eder.

## Duplicate dashboard

ID guard'ı yalnızca tek panel oluşturur. Aynı bundle iki kez yükleniyorsa sorunun kaynağı HTML script tekrarından aranmalıdır.

## Rollback sonrası eski UI

Service worker cache version'ı kontrol et. Eski shell cache'i aktifse hard refresh yerine kontrollü cache invalidation uygulanmalıdır.
