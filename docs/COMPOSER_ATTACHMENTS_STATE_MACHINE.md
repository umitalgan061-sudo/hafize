# Composer Ekleri — State Machine

## States
Closed: panel gizli.
Open: panel görünür.
Reading: seçili dosya okunuyor.
Ready: en az bir geçerli attachment queue'de.
Risk: seçilen kayıtlardan en az biri secret scanner bulgusu taşıyor.
Blocked: insert payload composer kapasitesine sığmıyor.

## Transitions
Dosya ekle → Open.
Dosya seç → Reading → Ready veya error.
Checkbox → Ready içinde selected değişimi.
Range değişikliği → Ready içinde start/end clamp.
Mesaja ekle → Ready → composer mutation.
Riskli Mesaja ekle → Risk → user confirm → Ready mutation veya cancel.
Son eklemeyi geri al → Ready/Closed state'te son snapshot uygun ise composer restore.
Escape → Closed.
Expiry → Closed queue-empty.
destroy → terminal cleanup.

## Invariants
Closed görünümde olsa da queue staged olabilir.
Insert başarısızsa composer eski value'sunu korur.
Network request attachment state transition değildir.
Submit attachment state machine'in parçası değildir.
Queue yalnız active runtime memory'de tutulur.