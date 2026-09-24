# Bağlantılar bağımlılıkları

## Browser

- DOM
- fetch
- AbortController
- sessionStorage
- clipboard optional
- Intl

## Existing application

- workspace-navigation
- /api/health
- Gmail status route
- Canva status route
- service worker shell policy

## No new package

Hub yeni npm dependency eklemez.

## Optional APIs

Clipboard ve AbortController yokluğunda kontrollü fallback bulunur.

## Test dependency

Testler Node built-in assert ve fs kullanır.

## Build

Hub static JS/CSS olduğundan ayrı bundler dependency gerektirmez.

## Security dependency

Authentication ve ownership server-side mevcut katmanlarda kalır.
