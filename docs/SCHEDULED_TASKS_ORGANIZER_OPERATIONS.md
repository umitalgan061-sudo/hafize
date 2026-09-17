# Organizer — Operasyon Runbook

## Kontrol

Önce `/api/schedules` servisinin erişilebilirliği kontrol edilir.

Sonra görevler paneli authenticated kullanıcı ile açılır.

Organizer shell asset'lerinin service worker listesinde bulunduğu doğrulanır.

## Kullanıcı raporu

"Görevler görünmüyor" bildirimi için önce oturum durumu kontrol edilir.

"Arama çalışmıyor" bildirimi için organizer search input'unun DOM'da bulunduğu kontrol edilir.

"Çoğaltma çalışmıyor" durumunda POST response ve server capacity kontrol edilir.

"Toplu iptal" durumunda DELETE response'ları incelenir.

## Local storage

`hafize.scheduled-tasks.view.v1` görünüm sıralama tercihlerini tutar.

`hafize.scheduled-tasks.views.v1` isimli preset görünüşlerini tutar.

Bu anahtarlar task payload'ı içermemelidir.

## Cache

Shell cache sürümü değiştiğinde organizer CSS/JS dosyalarının yeni cache'e girdiği doğrulanır.

`/api/schedules` response cache'den okunmamalıdır.

## Incident

Beklenmeyen UI state için kullanıcı sayfayı yenileyebilir.

Persistent görünüm bozulduysa ilgili view key'i manuel temizlenebilir.

Server task state bozulması organizer ile çözülmez; backend store incelemesi gerekir.

## Metrics

Organizer client telemetry göndermez.

Operasyon analizi server log ve mevcut traceId üzerinden yapılır.

## Rollback

CSS/JS asset rollback'i shell cache version ile birlikte değerlendirilir.

Eski organizer dosyaları cache'de kalmışsa service worker eski cache'i siler.
