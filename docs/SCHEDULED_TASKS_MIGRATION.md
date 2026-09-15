# Zamanlanmış Görevler — Migration

## Existing backend

Bu feature mevcut schedule runtime üzerine client UI ekler.

Backend storage formatını değiştirmez.

Schedule command fields değiştirilmez.

Worker state machine değiştirilmez.

## Deployment

Yeni CSS asset'i public shell'e eklenir.

Yeni JS asset'leri public shell'e eklenir.

Service worker cache version artırılır.

`/api/` network-only kalır.

## User data

Mevcut schedule records korunur.

UI ilk açılışta GET ile mevcut kayıtları çeker.

Client'a migration payload yazılmaz.

Local browser storage migration gerekmez.

## Compatibility

API destekleyen backend ile client birlikte kullanılabilir.

Backend endpoint yoksa UI servis hatası gösterir.

Eski backend status'u bilinmiyorsa UI fallback gösterir.

## Upgrade verification

Server startup.

Schedule auth.

Schedule storage.

Schedule worker.

GET schedules.

POST schedule.

DELETE scheduled record.

## Rollback

Client assetleri revert edilebilir.

Server schedule data korunur.

Worker çalışması client rollback'tan bağımsızdır.

## Cache transition

Yeni service worker version eski shell'i değiştirebilir.

Static schedule assets yeni cache'e alınır.

API snapshot cache'e eklenmez.

## Migration blockers

Endpoint path değiştirmeyin.

Auth model değiştirmeyin.

Owner semantics değiştirmeyin.

Status strings değiştirmeyin.

## Manual verification

Önceden var olan schedule panelden görünür.

Önceden var olan completed task doğru status ile görünür.

Önceden var olan failed task lastError ile görünür.

Scheduled task cancel edilebilir.

## Future migration

Recurring schedules eklenirse yeni data model versiyonu gerekmeyebilir, ancak API contract review gerekir.

Edit endpoint eklenirse client form yeniden tasarlanmalıdır.

Notifications eklenirse privacy review gerekir.

Timezone policy değişirse runAt contract yeniden değerlendirilmelidir.

## Acceptance

Migration sırasında veri kaybısı olmamalıdır.

Existing schedule IDs korunmalıdır.

Existing status transitions korunmalıdır.

Existing worker behavior değiştirilmemelidir.
