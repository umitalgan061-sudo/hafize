# Composer Ekleri — Test Matrisi

| Alan | Kontrol |
| --- | --- |
| Policy | limit, allowlist, normalize |
| Security | DOM, network, storage |
| UX | panel, preview, range |
| Clipboard | file paste ve text paste ayrımı |
| Drag/drop | drop event ve preventDefault |
| Insert | cursor/selection, no-submit |
| Undo | son insert snapshot |
| Secret scan | riskli pattern + confirm |
| Lifecycle | timer/listener cleanup |
| PWA | index ve shell cache |
| Accessibility | role, aria, focus |
| Support | hata metinleri |
| Privacy | no persistence |

## Kaynak sözleşme
Her test paketi dosyanın belirli bir davranışını kontrol eder. Regex tabanlı kontroller yalnızca varlık bağlantısını değil, güvenlik değişmezlerini de doğrular.

## Davranış sözleşmesi
Policy dosyası Node vm ortamında çalıştırılabiliyorsa normalize, line range, fence ve scanner davranışları gerçek fonksiyon çağrılarıyla doğrulanır.

## Release kapısı
Test dosyası eklenmiş olması tek başına başarı değildir; run-checks içinde otomatik keşfedilmesi gerekir.