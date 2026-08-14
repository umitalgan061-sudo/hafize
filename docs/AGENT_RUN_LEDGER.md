# Agent Run Ledger Entegrasyonu

Bu katman mevcut `createTaskLedger()` primitive'ini `/api/agent/run` yaşam döngüsüne bağlar.

## Kapsam

- Her agent run için mevcut `traceId` ile tek bir root görev açılır.
- NVIDIA tool call'ları root görevin child kayıtları olarak izlenir.
- Tool sonucu başarılıysa `completed`, başarısızsa `failed` olarak kaydedilir.
- Final agent run durumu, tool sonuçlarına ve final NVIDIA yanıtının geçerliliğine göre kapatılır.
- `/api/agent/run` JSON yanıtı aynı trace'e ait sanitize edilmiş `taskLedger` snapshot'ını içerir.

Bu PR yeni ajan, yeni tool veya yeni permission eklemez. Mevcut default-deny backend enforcement değişmeden kalır.

## Güvenlik

Ledger'a tool argümanları, GitHub dosya içerikleri, API token'ları veya NVIDIA secret'ları yazılmaz. Child kayıt yalnızca tool adı ve sabit/sanitize edilmiş sonuç kodu taşır.

Dış yazma, gönderme veya merge işlemleri bu değişiklikle açılmaz.

## Test

`test-agent-run-ledger.mjs` şu davranışları doğrular:

- root ve tool kayıtlarının aynı trace altında olması,
- tool kaydının root kayda parent-child bağıyla bağlanması,
- başarılı tool/run durumlarının `completed` olması,
- başarısız tool/run durumlarının `failed` olması,
- hata detayının yalnızca güvenli sonuç kodundan oluşması.
