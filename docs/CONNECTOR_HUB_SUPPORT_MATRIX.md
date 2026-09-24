# Connector hub destek matrisi

| Durum | Genel | Gmail | Canva | GitHub |
|---|---|---|---|---|
| Yapılandırılmış | Hazır | Hazır | Hazır | Hazır |
| Bağlı | Özet | Bağlı | Bağlı | Salt-okunur hazır |
| Bağlı değil | Özet | Bağlı değil | Bağlı değil | Salt-okunur hazır/kapalı |
| Yapılandırılmamış | Kapalı | Devre dışı | Devre dışı | Kapalı |
| Auth eksik | Kısmi | Oturum gerekli | Oturum gerekli | Health policy'ye bağlı |
| Network hata | Kısmi | Hata | Hata | Hata |
| Timeout | Kısmi | Hata | Hata | Hata |

## Not

GitHub kartında kullanıcı bağlantı kaydını ayrı bir linked endpoint ile okumak yerine mevcut health/configuration sinyali kullanılır.

## UI ilkesi

Bir provider'ın hata vermesi diğer provider kartını gizlemez.
