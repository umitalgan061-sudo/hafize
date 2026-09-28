# Failure Modes

## Offline
Request başlatılmaz.

## Missing model
Request başlatılmaz.

## Missing agent
Request başlatılmaz.

## HTTP failure
Old content restore edilir.

## SSE failure
Old content restore edilir.

## Empty response
Mevcut stream empty-message contract'i uygulanır; regeneration başarısızlığında previous content geri yüklenir.

## Clipboard failure
Chat state değişmez.

## Storage failure
Mevcut persistence warning kullanılır.

## Double click
isStreaming ikinci generation'ı engeller.

## Stale message
Eski assistant mesajı regenerate edilemez.

## Corrupt alternate
Normalization diğer mesajın açılmasını engellemez.
