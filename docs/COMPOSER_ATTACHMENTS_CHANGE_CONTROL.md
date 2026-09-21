# Composer Ekleri — Change Control

## Safe change
Yeni attachment değişikliği aynı branch + PR akışında yapılır.

## Limits
Limit artışı tek başına kabul edilmez; performance/security etkisi değerlendirilir.

## Security
Scanner rule değişiklikleri test ve review kapsamına girer.

## Storage
Yeni persistence yalnız ayrı veri-retention tasarımıyla yapılır.

## Network
Attachment modülü içine upload endpoint eklemek ayrı feature'dır.

## UI
Yeni action no-submit ve keyboard davranışlarını korumalıdır.

## Release
Index ve service worker asset wiring aynı PR'da tutulur.