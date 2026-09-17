# Organizer — Performans

## Rendering

Organizer mevcut DOM satırlarını yeniden kullanır.

Liste her server refresh'inde yeniden oluşturulsa da görünüm katmanı yalnızca ek kontrolleri sağlar.

Arama ve filtre işlemleri en fazla mevcut schedule listesi üzerinde çalışır.

## Bounds

Server listesi mevcut panel limiti olan 128 kayıtla sınırlıdır.

Toplu seçim ve iptal 40 kayıtla sınırlıdır.

Preset sayısı altı ile sınırlandırılır.

Arama metni 120 karakterle sınırlıdır.

## Storage

Preset write küçük metadata içerir.

Task payload localStorage'a taşınmaz.

Storage hata verdiğinde UI varsayılan değerlere döner.

## Network

Organizer yalnızca gerekli GET/POST/DELETE çağrılarını mevcut schedule endpoint'ine yapar.

Filtre değişimi network isteği üretmez.

Preset seçimi network isteği üretmez.

Detail açılışı network isteği gerektirmez çünkü görünür satır özetini kullanır.

Export gerektiğinde yalnızca bir GET ile güncel snapshot alınır.

## Concurrency

Toplu iptal işlemleri sıralı yürütülür.

Bu, aynı kullanıcı için ani burst DELETE çağrılarını sınırlar.

Panel refresh'i server snapshot'ını tekrar otorite yapar.

## DOM observation

MutationObserver yalnızca panel DOM'u içinde kullanılır.

Organizer ve actions modülleri kendi marker'larıyla duplicate mounting'i önler.

## Mobile performance

Mobilde CSS grid iki sütuna düşer.

Uzun task metinleri DOM üzerinde sınırlı preview ile tutulur.

## Performance acceptance

2000+ DOM dışı task record local client cache'e yüklenmez.

Server'ın verdiği maksimum panel listesi aşılmaz.

Filtre için üçüncü taraf kütüphane yüklenmez.

Ölçülebilir darboğaz görülürse optimizasyon ayrı turda yapılır.
