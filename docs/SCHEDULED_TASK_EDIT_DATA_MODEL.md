# Schedule Edit Data Model

Update işlemi mevcut schedule kaydını yeniden kullanır.

## Kimlik alanları
`scheduleId`, `traceId` ve `ownerId` değişmez.

## Yürütme alanları
`status` edit sırasında `scheduled` kalır. `attempts` korunur.

## Kullanıcı alanları
`agentId`, `task`, `runAt`, `maxAttempts` güncellenebilir.

## Zaman alanları
`runAt` ISO tarih olarak normalize edilir. Update anında gelecekte olması zorunludur.

## Deneme alanı
`maxAttempts` 1–5 aralığındadır. Mevcut attempts değerinin altına düşürülemez.

## Audit alanları
`createdAt` korunur. `updatedAt` başarılı update anında güncellenir. Task metni değiştiğinde `lastError` temizlenir.

## Public model
HTTP response ownerId içermez; mevcut publicSchedule sözleşmesi korunur.
