# Composer Ekleri — Geliştirici Rehberi

## Modüller
Policy, secret scanner ve runtime ayrı sorumluluklar taşır.

Policy yalnız normalize, limit ve format işlemlerinden sorumludur.
Secret scanner yalnız risk bulgusu üretir.
Runtime DOM, File API ve kullanıcı eylemleriyle kuyruğu yönetir.

## Dependency direction
Runtime policy ve scanner'ı global API üzerinden tüketir. Policy runtime'a DOM bağımlılığı taşımaz.

## State
Queue yalnız runtime closure içinde tutulur. Kalıcı storage bulunmaz.

## Event
Insert sonrası hafize:composer-attachments-inserted event'i yayınlanır. Event payload yalnız count bilgisidir.

## DOM
render replaceChildren kullanır. File content textContent ile üretildikten sonra pre elementine verilir.

## Lifecycle
mount idempotent olmalıdır. destroy timer, document listener ve trigger listeners temizlemelidir.

## Yeni geliştirme
Yeni özellik queue state'ini localStorage'a taşımamalı. Persistence ihtiyacı ayrı tasarım incelemesi gerektirir.

## Test
Kaynak sözleşme testleri test-*.mjs biçimindedir ve run-checks tarafından keşfedilir.