# Bağlantılar durum makinesi

## Controller

new -> mounted -> refreshing -> idle

Destroy ile:

mounted -> destroyed

## Collapse

visible -> collapsed

veya

collapsed -> visible

## Refresh

idle + cooldown passed -> refreshing

refreshing -> idle

## Error

Her provider bağımsız olarak:

pending -> ready | linked | unlinked | disabled | auth-required | error

## Refresh güvenliği

Refreshing durumundayken yeni refresh isteği başlamaz.

## Destroy

Destroy sonrası async callback sonucunu UI'a yazmak yasaktır.

## Session

Collapse state varsa mount sırasında uygulanır. Bozuk session payload varsayılan state'e dönüşür.

## No write

State machine içinde connector permission mutation geçişi yoktur.

## Test

Testler state guard, destroy ve error normalization koşullarını doğrular.
