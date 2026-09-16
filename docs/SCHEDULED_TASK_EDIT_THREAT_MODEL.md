# Schedule Edit Threat Model

## Untrusted input
PATCH gövdesi tamamen untrusted kabul edilir. Field allowlist ve tip/sınır kontrolleri uygulanır.

## Broken ownership
Schedule id tek başına yeterli yetki değildir. Principal subject ile ownerId eşleşmesi gerekir.

## State confusion
Client'ın gönderdiği status, attempts, ownerId veya traceId update edilemez.

## Credential leakage
Task metni mevcut plaintext credential policy ile taranır.

## Cache leakage
Schedule API cache'lenmez. Browser storage'a task body yazılmaz.

## Bulk amplification
Selection 40 kayıtla sınırlıdır; işlem yeni server-side bulk endpointi eklemeden mevcut bounded mutation yollarını kullanır.

## Race
Persistence mutation queue aynı kayıt üzerindeki update'leri sıralar.
