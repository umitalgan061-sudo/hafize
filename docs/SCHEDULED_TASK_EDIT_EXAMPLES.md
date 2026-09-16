# Schedule Edit Examples

## Metin değiştir
```json
{ "task": "Bugünkü raporu kısa maddeler halinde hazırla" }
```

## Zaman değiştir
```json
{ "runAt": "2026-09-17T09:30:00.000Z" }
```

## Ajan ve deneme değiştir
```json
{ "agentId": "planner", "maxAttempts": 3 }
```

## Birlikte
```json
{ "agentId": "research", "task": "Yeni kaynakları incele", "runAt": "2026-09-17T11:00:00.000Z", "maxAttempts": 4 }
```

## Quick postpone
UI `+15 dk` yalnız `{ runAt }`, `+1 saat` yine yalnız `{ runAt }` gönderir.

## Repeat-plan
UI mevcut task ve agent değerlerini koruyarak yeni bir POST oluşturur. Eski scheduleId değiştirilmez.
