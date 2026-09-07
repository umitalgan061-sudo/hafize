# Configuration readiness

`evaluateConfigReadiness()` deployment ortamını secret değerlerini açığa çıkarmadan sınıflandırır.

- production/public runtime'da auth secret eksikse `blocked`.
- proxy trust açık ama gerekçe belirtilmemişse `degraded`.
- boolean ve secret newline hataları deterministic finding üretir.
- Modül credential değerlerini rapora taşımaz.

Bu contract deploy/merge yapmaz; yalnızca release öncesi configuration gate sağlar.

## Deployment gate

`evaluateDeploymentReadiness()` mevcut runtime, configuration ve release sonuçlarını tek bir sonuca indirger.

Bir bileşen `blocked` ise sonuç kesinlikle `blocked` kalır.

Geçersiz veya eksik bir bileşen `unknown` olarak fail-safe ele alınır.

`releaseable` yalnızca bütün gerekli bileşenler `ready` olduğunda `true` olur.

Finding detayları bounded tutulur ve secret değerleri taşınmaz.
