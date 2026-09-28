# Bağımlılıklar

## Runtime
Feature mevcut typed app-shell.ts ve response-variants.ts modülüne dayanır.

## Browser
Fetch streaming, TextDecoder, localStorage ve optional Clipboard API kullanır.

## Build
Vite mevcut public/typed source'u üretim artifact'ına dönüştürür.

## Test
Vitest pure helper testlerini ve repository source-contract scriptlerini çalıştırır.

## Backend
Yeni route eklemez. Mevcut chat ve agent run endpoint'leri kullanılır.

## Service worker
Yeni response data cache politikası yoktur.

## External
Yeni npm dependency yoktur.

## Security
Connector auth ve OAuth scope'ları değişmez.
