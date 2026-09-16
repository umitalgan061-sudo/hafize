# Schedule Edit State Machine

## Durumlar
`scheduled`, `running`, `completed`, `failed`, `cancelled` mevcut yürütme durumlarıdır.

## Düzenlenebilir durum
Yalnız `scheduled` kayıtlar değiştirilebilir.

## Edit geçişi
`scheduled -> scheduled` olur. `scheduleId`, `traceId`, `ownerId`, `attempts` ve `createdAt` korunur. `task`, `agentId`, `runAt` ve `maxAttempts` güncellenebilir.

## Hata
Geçersiz giriş state'i değiştirmez. Sahiplik doğrulaması başarısızsa kayıt bulunamadı gibi davranılır.

## Execution
Worker claim etmeden önce yeniden planlama yapılabilir. Claim sonrası kayıt `running` olur ve edit reddedilir.

## Retry
`maxAttempts` yükseltilebilir ancak mevcut `attempts` sayısının altına indirilemez. Düzenleme geçmişteki attempt sayısını sıfırlamaz.

## Quick postpone
`+15 dk` ve `+1 saat` yalnız `runAt` alanını PATCH ile değiştirir.

## Repeat-plan
`Tekrar planla` yeni bir schedule oluşturur; kaynak kayıt değişmez.
