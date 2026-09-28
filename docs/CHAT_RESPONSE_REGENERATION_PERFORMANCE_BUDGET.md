# Performance Budget

## Memory
Response alternates per message <= 3.

## Content
Her stored response <= 12000 karakter.

## Instruction
Custom instruction <= 600 karakter.

## UI
Variant preview <= 8000 karakterlik görünür içerikle sınırlandırılır.

## Network
Regeneration mevcut SSE channel'i kullanır; yeni polling eklenmez.

## Storage
Her successful transition bounded conversation JSON write kullanır.

## DOM
Action row ve dialog küçük, sınırlı node sayısında kalır.

## Recovery
Failure path yeni backup file veya snapshot oluşturmaz.

## Cache
Response data service worker cache'e girmez.

## Acceptance
Ölçülebilir sınırlar feature büyüdükçe korunmalıdır.
