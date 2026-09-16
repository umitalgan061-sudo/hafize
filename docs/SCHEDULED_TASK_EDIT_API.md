# Schedule Edit API

## Endpoint
`PATCH /api/schedules/:id`

## Yetkilendirme
İstek, schedule runtime'ın Bearer kimliğiyle doğrulanır. Kimlik doğrulama yoksa `401 AUTH_REQUIRED` döner.

## Gövde
İzin verilen alanlar: `agentId`, `task`, `runAt`, `maxAttempts`.

Ek alanlar reddedilir. Boş gövde reddedilir.

## Sahiplik
Kayıt mevcut kullanıcıya ait değilse `404 SCHEDULE_NOT_FOUND` döner. İstemciye başka sahibin kayıtlarının varlığı açıklanmaz.

## Durum
Yalnızca `scheduled` durumdaki kayıtlar güncellenebilir. Diğer durumlarda `409 SCHEDULE_NOT_EDITABLE` döner.

## Doğrulama
Ajan registry'de bulunmalıdır. Görev metni 1–20.000 karakterdir ve düz metin credential içeremez. `runAt` geçerli ve gelecekte olmalıdır. `maxAttempts` 1–5 arasında ve mevcut attempt sayısından düşük olmayacak şekilde seçilir.

## Sonuç
Başarılı işlem güncellenmiş public schedule ile `200` döner. `ownerId` public response'a dahil edilmez.

## Cache
API cevapları `no-store` davranışını korur; service worker schedule verisini önbelleklemez.
