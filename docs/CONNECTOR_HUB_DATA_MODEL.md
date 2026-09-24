# Bağlantılar veri modeli

## UI state

collapsed: boolean.

## Runtime state

refreshInFlight: boolean.

lastRefreshAt: sayı olarak refresh flood kontrolü için tutulur.

## Provider health

Health endpoint'inden:

githubReadConfigured

gmailReadConfigured

canvaReadConfigured

## Provider link

Gmail ve Canva status endpoint'lerinden:

linked

## Internal aggregation

Hub aşağıdaki kavramları birleştirir:

- hazır connector sayısı
- kullanıcıya bağlı provider sayısı
- okunamayan endpoint sayısı
- son refresh zamanı

## Persisted model

Kalıcı prompt, conversation veya connector modeline ek alan yazılmaz.

## Session model

hafize.connector-hub.v1 = { collapsed: boolean }

## Migration

Anahtar yoksa varsayılan collapsed=false kabul edilir.

Bozuk JSON varsa state sıfırlanır.

## Nullability

Provider cevapları eksik alan içerebilir. UI bunları güvenli fallback ile ele alır.

## Compatibility

Eski browser storage kayıtları okunamazsa özellik varsayılan açık durumda çalışır.

## Secret exclusion

Bu modelde token, code, refresh token, ownerId veya OAuth verifier alanı bulunmaz.

## In-memory only

Health response'ın tamamı sadece refresh süresince bellekte tutulur.

## Data contract tests

Testler alan tiplerini, fallback durumlarını ve storage isolation'ı doğrular.
