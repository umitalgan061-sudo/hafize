# Diagnostics data retention

Diagnostics raporu kalıcı analytics kaydı değildir.

Repair checkpoint yalnızca son repair için tutulur ve undo sonrasında temizlenir.

Quarantine bounded bir local storage alanıdır ve en fazla 80 raw kayıt taşır.

Recovery export dosyası kullanıcı kontrolündedir; uygulama onu otomatik yüklemez.

Remote retention veya telemetry yoktur.
