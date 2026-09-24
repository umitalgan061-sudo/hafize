# Bağlantılar QA planı

## Smoke

- uygulamayı aç
- Bağlantılar workspace'ine geç
- kartların oluştuğunu doğrula
- refresh'e bas
- sonuçları gör

## Contract

- health URL
- Gmail status URL
- Canva status URL
- GET method
- same-origin credential
- JSON accept header

## Security

- Authorization header yok
- POST yok
- PUT yok
- DELETE yok
- fetch dış origin yok
- token literal yok
- innerHTML yok

## Lifecycle

- mount bir kez
- destroy kartları kaldırır
- listener'lar kaldırılır
- destroy sonrası async sonucu DOM'u değiştirmez

## Storage

- session state anahtarının adı doğru
- provider response persist edilmez
- bozuk JSON güvenli fallback
- storage exception uygulamayı durdurmaz

## Accessibility

- section
- aria-labelledby
- aria-expanded
- aria-controls
- focus-visible
- text-only status

## Responsive

- 700px altında tek kolon
- refresh butonu kullanılabilir
- provider metni taşmaz
- yatay overflow oluşmaz

## PWA

- JS precache
- CSS precache
- API network-only

## Failure

- 401
- 404
- 500
- timeout
- network failure
- bad JSON

## Acceptance

Tüm testler kaynak sözleşmesini doğrular; hosted CI mevcutsa exact HEAD üzerinde ayrıca çalıştırılır.
