# Alt Ajan Yaşam Döngüsü

`lib/agent-lifecycle.mjs`, delege edilen alt ajan koşuları için açık bir durum makinesi tutar. `CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 3. maddenin (sub-agent cancellation / concurrency / message lifecycle) ilk adımıdır.

## Durumlar

`running → completed | failed | cancelled`

- `completed` ve `failed` normal kapanışlardır.
- `cancelled` açık bir karardır; geri alınamaz.
- Kapanmış bir koşu yeniden kapatılamaz (`AGENT_RUN_ALREADY_FINISHED`).

## Sözleşme

- **İptal yarışı kazanır.** Koşu iptal edildikten sonra gelen başarılı sonuç kabul edilmez; `finish()` `AGENT_RUN_CANCELLED` döner ve durum `cancelled` kalır.
- **İptal gözlemlenebilir.** Her koşu kendi `AbortController`'ını taşır; `start()` çağıranı `signal` ile döner, böylece devam eden HTTP/model çağrısı da düşer.
- **Üst istek düşerse alt koşular da düşer.** `parentSignal` verildiğinde abort tüm canlı koşuları `PARENT_ABORTED` gerekçesiyle iptal eder ve yeni koşu açılmasını `AGENT_LIFECYCLE_STOPPED` ile engeller.
- **Eşzamanlılık sınırlıdır.** Aynı anda çalışan koşu sayısı `maxConcurrent` (varsayılan 2, tavan 8) ile sınırlıdır; aşan istek `AGENT_CONCURRENCY_EXCEEDED` ile reddedilir. Toplam koşu sayısı 64 ile sınırlıdır.
- **Mesaj yalnızca canlı koşuya gider.** Tamamlanmış veya iptal edilmiş bir ajana mesaj gönderimi `AGENT_RUN_NOT_ACCEPTING_MESSAGES` ile reddedilir. Kuyruk 8 mesajla sınırlıdır; taşan mesaj sessizce düşürülmez, `AGENT_INBOX_FULL` döner.
- **Girdi fail-closed doğrulanır.** Beklenmeyen alan taşıyan koşu tanımı, boş/aşırı uzun `taskId`/`agentId` ve tekrar eden `taskId` reddedilir.
- **Gerekçe metni sanitize edilir.** 120 karakteri aşan veya boş iptal gerekçesi sabit `AGENT_RUN_CANCELLED` koduna indirilir.

## Delegasyon ile bağ

`createAgentDelegator({ ..., lifecycle })` isteğe bağlıdır; verilmezse mevcut davranış birebir korunur. Verildiğinde:

- her delegasyon, ledger'daki delegation task id'si ile bire bir eşleşen bir lifecycle koşusu açar;
- `executeAgent` çağrısına `signal` geçirilir;
- eşzamanlılık bütçesi dolduysa delegasyon `DELEGATION_CONCURRENCY_EXCEEDED`, iptal edilmişse `DELEGATION_CANCELLED` ile başarısız olur;
- her iki durum da task ledger'a sabit sonuç kodu olarak yazılır.

## Güvenlik sınırı

Bu katman yetki vermez. Hangi ajanın hangi aracı görebileceği registry tool policy'sinde kalır; alt ajan üst ajanın tool listesini miras almaz ve `approvalGranted` alt koşuda `false` kalmaya devam eder. Snapshot'a mesaj içeriği, tool argümanı, dosya içeriği veya secret yazılmaz; yalnızca `taskId`, `agentId`, durum, sabit gerekçe kodu, zaman damgaları ve bekleyen mesaj sayısı görünür.

## Test ve geri alma

`scripts/test-agent-lifecycle.mjs` durum makinesini, iptal yarışını, eşzamanlılık tavanını, mesaj kabulünü, parent abort yayılımını ve snapshot sızıntısını; `scripts/test-delegation-lifecycle.mjs` delegasyon bağını (signal geçişi, geç sonucun reddi, eşzamanlılık reddi, parent abort, lifecycle'sız geriye dönük uyumluluk) doğrular. `lifecycle` parametresi geçirilmediğinde delegasyon eski yoluna döner; modül ve testleri silinerek değişiklik tamamen geri alınabilir.
