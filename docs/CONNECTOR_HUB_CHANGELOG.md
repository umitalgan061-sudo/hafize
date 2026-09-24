# Connector hub changelog

## 1.0

Bağlantılar workspace'i için ilk hub davranışı:

- toplu health özeti
- Gmail bağlantı durumu
- Canva bağlantı durumu
- GitHub read readiness
- manuel refresh
- timeout
- refresh cooldown
- collapse state
- capability görünürlüğü
- tanı özeti

## Güvenlik

Client-side write action yoktur.

## Gizlilik

Provider response kalıcı storage'a yazılmaz.

## PWA

UI asset'leri shell cache'e eklenir.

## Erişilebilirlik

aria-expanded, aria-controls ve görünür focus sağlanır.

## Sonraki uyumluluk

Yeni provider eklemek için API status contract'ı, capability listesi ve workspace card ID aynı tasarım ilkeleriyle genişletilmelidir.
