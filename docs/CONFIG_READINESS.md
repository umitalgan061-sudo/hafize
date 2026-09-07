# Configuration and deployment readiness

`evaluateConfigReadiness()` production/public çalışma ortamını secret değerlerini rapora taşımadan sınıflandırır. Eksik public auth secret'ı `blocked`, belgelenmemiş trusted-proxy kullanımı `degraded`, geçersiz boolean ve secret newline değerleri deterministic finding üretir.

`evaluateDeploymentReadiness()` runtime, config ve release sonuçlarını tek bir deployment gate altında birleştirir. `blocked` ve `unknown` durumları fail-closed kalır; yalnız tamamen `ready` bileşenlerden oluşan rapor releaseable kabul edilir. Finding ayrıntıları bounded tutulur.

Bu katman deploy, merge veya secret üretimi yapmaz. Amaç release öncesi configuration/operational durumun kodlanmış ve test edilebilir bir kanıtını üretmektir.
