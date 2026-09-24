# Connector hub test rehberi

## Kaynak testleri

Source contract paketleri URL ve method sözleşmelerini doğrular.

## Security testleri

Secret, auth header, cross-origin fetch ve write method yokluğunu kontrol eder.

## Runtime testleri

Timeout, JSON failure, fetch absence ve finally cleanup doğrulanır.

## Workspace testleri

Navigation card listesi ve index asset wiring doğrulanır.

## PWA testleri

JS/CSS shell asset'leri ve API network-only kuralı doğrulanır.

## Accessibility

Aria attributes, native buttons ve responsive CSS doğrulanır.

## Storage

Session-only state doğrulanır.

## Regression

Capability catalog, diagnostics, workspace event ve initial refresh birlikte kontrol edilir.

## Manuel smoke

1. uygulamayı aç
2. Bağlantılar workspace'ine geç
3. üç provider kartını gör
4. refresh'e bas
5. gizle/göster
6. tanı özetini kopyala

## Failure simulation

Fetch'i rejection verecek şekilde stub'la.

401 ve non-2xx JSON response üret.

AbortController timeout üret.

## Pass kriteri

Hiçbir test provider credential'ı üretmez veya loglamaz.
