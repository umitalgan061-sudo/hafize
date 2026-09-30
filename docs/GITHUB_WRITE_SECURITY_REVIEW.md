# GitHub Güvenli Yazma Güvenlik İncelemesi

## Trust boundary
Browser yalnız same-origin Hafize endpoint'lerini görür. GitHub tokenı writer module'üne server-side enjekte edilir ve HTML/JavaScript içine gömülmez.

## Authorization
Write allowlist ayrı tutulur. Production guard yalnız authenticated application session için write route'larına erişim verir. Connector principal write route'larına erişemez.

## Approval
Approval payload'i server'da tekrar normalize edilir. Fingerprint yalnız normalized payload'dan üretilir. Ticket bir kullanıcı onayı yerine geçmez; onayın sonucu olarak yalnız kısa ömürlü sunucu yetkisi sağlar.

## Concurrency
File update için existingSha kullanılması GitHub Contents API'nin current-object kontrolüyle birlikte çalışır. Eski SHA ile değişmiş dosyaya yazma sessiz overwrite yerine upstream conflict üretmelidir.

## Capability reduction
Writer yalnız branch, file commit ve pull request action'ları export eder. Merge, force-push, branch deletion ve workflow modification capability'si yoktur.

## Data minimization
Write response yalnız kullanıcının sonraki adımı için gerekli güvenli alanları döndürür. Raw upstream JSON, headers veya token bilgisi client'a aktarılmaz.

## Local history
History yalnız başarılı operasyon metadata'sı saklar. Content ve ticket dışarıda bırakılır. Kopyalama yalnız kullanıcı tıklamasıyla yapılır.

## Residual risk
GitHub hesabının kendi yetkileri yanlış yapılandırılmışsa upstream write yine mümkün olabilir. Bu feature repository governance yerine geçmez; yalnız Hafize içindeki capability'yi daraltır.
