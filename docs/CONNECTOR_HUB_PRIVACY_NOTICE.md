# Bağlantılar gizlilik bildirimi

## Bu panel neyi görür?

Panel yalnız connector'ın hazır veya bağlı olup olmadığını gösterir.

## Bu panel neyi görmez?

- e-posta içeriği
- e-posta gövdeleri
- Canva tasarım içeriği
- GitHub dosya içeriği
- access token
- refresh token
- OAuth verifier

## Network

Durum sorguları same-origin API endpoint'lerine GET ile yapılır.

## Storage

Provider response kalıcı browser storage'a yazılmaz.

## Session

Panel görünürlük tercihi sessionStorage içinde tutulabilir.

## Analytics

Connector hub üçüncü taraf analytics veya telemetry çağırmaz.

## Cache

API sonuçları service worker cache'ine yazılmaz.

## Kullanıcı kontrolü

Kullanıcı refresh'i manuel tetikleyebilir.

## Ayrı policy katmanı yok

Hub server'daki authentication ve ownership kurallarını tekrar tanımlamaz.

## Bildirim

Tanı özeti kopyalanırsa yalnız özet durum metinleri panoya gider; credential bilgisi gitmez.
