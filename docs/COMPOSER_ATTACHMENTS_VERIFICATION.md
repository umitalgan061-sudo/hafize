# Composer Ekleri — Verification Matrix

## Release proof

Bu belge feature'ın kabul kriterlerini kod, static contract ve manuel browser doğrulaması olarak üç katmanda ayırır.

| Katman | Örnek | Kanıt |
| --- | --- | --- |
| Policy behavior | normalize/range/fence | deep VM test |
| Security source | no network/no storage | source contracts |
| UI source | aria/no-submit | DOM contracts |
| Browser | file picker/drop/paste | manual matrix |
| PWA | static asset cache | PWA contract |
| UX | cursor/undo/quick actions | source + manual |

## Security proof

Byte limit read öncesi uygulanır.
Secret scanner local çalışır.
Riskli içerik confirm olmadan composer'a taşınmaz.
Dosya içeriği storage'a yazılmaz.
Attachment runtime network request oluşturmaz.
Insert submit etmez.

## Data proof

Queue in-memory'dir.
Expiry 15 dakikadır.
Sayfa refresh sonrası staged content geri gelmez.
Sent message content normal conversation data'sı olabilir.

## UX proof

Checkbox selected state'i kontrol eder.
Range 400 satırdan uzun olamaz.
Preview 12 satırla bounded'dir.
Copy selected range'i clipboard'a alır.
Insert caret/selection konumunu korur.
Undo yalnız güvenli snapshot koşulunda çalışır.
Quick actions selected ranges'i kullanır.

## PWA proof

Index, policy, scanner, runtime ve CSS assetlerini bağlar.
Shell cache aynı static assetleri listeler.
Cache version v37'dir.
API route'ları network-only kalır.

## Manual signoff

1. Dosya ekle ile panel açılır.
2. JS dosyası seçilir.
3. Preview açılır.
4. Range değiştirilir.
5. Checkbox kapatılır/açılır.
6. Kopyala denenir.
7. Mesaja ekle denenir.
8. Undo denenir.
9. Riskli sample ile confirm akışı gözlenir.
10. Quick action denenir.
11. Escape ile panel kapanır.
12. Normal Gönder dışında request oluşmadığı kontrol edilir.

## Limit signoff

4 file, 256 KB/file, 80K/file, 200K queue, 400 lines/range, 11.5K insert ve 80K scanner budgets değişmez.

## Rollback signoff

Attachment code/CSS, app wiring, index wiring ve shell cache entries ayrı olarak geri alınabilir.

Conversation, Prompt Library ve Composer History verileri rollback nedeniyle silinmez.