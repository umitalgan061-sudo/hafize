# Configuration readiness

`evaluateConfigReadiness()` deployment ortamını secret değerlerini açığa çıkarmadan sınıflandırır.

- production/public runtime'da auth secret eksikse `blocked`.
- proxy trust açık ama gerekçe belirtilmemişse `degraded`.
- boolean ve secret newline hataları deterministic finding üretir.
- Modül credential değerlerini rapora taşımaz.

Bu contract deploy/merge yapmaz; yalnızca release öncesi configuration gate sağlar.
