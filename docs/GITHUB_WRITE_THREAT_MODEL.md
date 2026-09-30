# GitHub Güvenli Yazma Tehdit Modeli

| Tehdit | Kontrol |
| --- | --- |
| Yetkisiz repository write | Ayrı server write allowlist |
| UI manipülasyonu | Server normalization + allowlist |
| Onay bypass | Session + CSRF + explicit approval |
| Ticket replay | Tek kullanımlık Map tüketimi |
| Ticket reuse | TTL + purge |
| Payload tampering | SHA-256 fingerprint binding |
| Default branch kazası | Server-side default branch check |
| Secret file write | Sensitive path deny |
| Workflow değişikliği | .github/workflows deny |
| Credential commit | plaintext credential detection |
| Token browser sızıntısı | server-side token only |
| XSS | textContent/createElement |
| Response data leak | normalized write response |
| Memory exhaustion | 1000 ticket cap |
| Local history leakage | contentless 12 item sessionStorage |

Güvenlik katmanı kullanıcı onayını kaldırmaz; onu server-side koşulla destekler.
