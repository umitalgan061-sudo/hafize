# Composer Ekleri — Threat Model

## Asset
Korunan varlıklar dosya içeriği, dosya adı, composer metni ve browser memory'dir.

## Aktörler
Kötü niyetli filename, oversized file, binary file ve hassas dosya içeren normal kullanıcı senaryosu ele alınır.

## Saldırı / kontrol
| Tehdit | Kontrol |
| --- | --- |
| HTML injection | textContent |
| path traversal filename | safeName |
| memory exhaustion | pre-read byte + count + chars |
| binary payload | allowlist + binary score |
| accidental request | no fetch/xhr/ws/beacon |
| accidental submit | input event only |
| stale sensitive memory | 15 min expiry |
| lifecycle leak | destroy cleanup |
| cache leakage | user files never in SW shell |

## Güven sınırı
Attachment layer browser UI içinde kalır. Upload endpoint'i veya server-side document storage çağırmaz.

## Varsayım
Kullanıcı composer'a eklenen metni normal sohbet olarak gönderebilir. Bu noktadan sonraki data handling chat runtime sözleşmesinin parçasıdır.

## İnceleme
Yeni değişiklikler bu kontrollerden herhangi birini kaldırıyorsa ayrı güvenlik incelemesi gerekir.