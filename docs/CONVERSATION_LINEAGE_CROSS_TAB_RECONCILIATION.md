# Conversation lineage cross-tab reconciliation

## Problem

`hafize.conversation-branches.v1` browser localStorage üzerinde bounded metadata tutar. İki Hafize sekmesi aynı canonical conversation snapshot'ından aynı anda farklı branch üretirse klasik read-modify-write sırası son-yazan-kazan veri kaybına yol açabilir: bir sekmenin yeni lineage edge'i diğer sekmenin snapshot'ı tarafından ezilebilir.

## Tasarım

Her lineage controller yalnız kendi sayfa oturumunda başarıyla kaydettiği branch edge'lerini bounded bir `sessionRecorded` map içinde hatırlar. Bu map persistent storage değildir ve controller destroy edildiğinde temizlenir.

Başka sekmeden lineage veya canonical conversation storage değişikliği geldiğinde controller:

1. canonical conversation snapshot'ını storage guard üzerinden yeniden okur,
2. source-retention-aware conversation/message ID index'ini yeniden kurar,
3. güncel lineage storage ile bu sekmenin hatırladığı başarılı local edge'leri birleştirir,
4. tüm adayları mevcut source/ancestry/duplicate kurallarından yeniden geçirir,
5. deterministic canonical sıraya getirir,
6. yalnız serialized sonuç gerçekten farklıysa best-effort storage write yapar.

Bu storage-event tabanlı iyileştirme browser localStorage için transaction/CAS iddiasında bulunmaz. Ama normal browser cross-tab event teslimi altında son-yazan-kazan kaybını convergent bounded metadata merge ile iyileştirir.

## Deterministik sıra

Merge sırası:

- `createdAt` yeni → eski,
- eşit timestamp'te `childConversationId` lexical sıra.

Duplicate child için bu sıra first-wins davranışını deterministik yapar. Mevcut `MAX_ENTRIES=60` sınırı merge sonrasında da uygulanır.

## Source retention önceliği

Cross-tab reconciliation hiçbir stale edge'i yeniden canlandıramaz. Parent source mesaj canonical retained history'de yoksa edge merge adayından atılır. Bir edge session memory'de tutuluyor olsa bile retention nedeniyle invalid hale geldiğinde `sessionRecorded` içinden de temizlenir. Source daha sonra aynı ID ile yeniden görünse bile silinmiş session edge otomatik olarak diriltilmez.

## Veri minimizasyonu

Session memory ve persistent lineage yalnız şu metadata alanlarını içerir:

- child conversation ID,
- parent conversation ID,
- source message ID,
- mode (`fork|edit`),
- ISO creation timestamp.

Mesaj metni, sohbet başlığı, model/tool payload'ı, ownerId, traceId, cookie, token, OAuth credential veya provider secret merge katmanına kopyalanmaz.

## Ping-pong önleme

Reconciliation canonical JSON ile mevcut raw storage değerini karşılaştırır. Değer eşitse yeni `setItem` çağrısı yapılmaz. Böylece iki sekmenin aynı birleşik state'e ulaştıktan sonra storage-event yazım döngüsü oluşturması engellenir.

## Failure davranışı

- Storage read başarısızsa reconciliation false döner ve destructive fallback yapmaz.
- Storage write başarısızsa mevcut persistent state korunur; controller read path yine canonical doğrulamayı kullanır.
- Conversation/source invalidation, merge sırasında local session memory'deki stale edge'i de düşürür.
- Destroy cross-tab listener'ı ve session-only remembered edge'leri temizler.

## Test matrisi

Regresyonlar şunları kapsar:

1. `merge(A,B) == merge(B,A)` canonical sıra,
2. yeni duplicate-child kaydının deterministik seçimi,
3. source-retention filtresinin merge sırasında uygulanması,
4. 60 kayıtlık bounded flood,
5. remote overwrite sonrası local session edge'in geri birleşmesi,
6. aynı canonical storage event'inin tekrar yazım üretmemesi,
7. conversation/source invalidation sonrası remembered edge'in temizlenmesi,
8. iki gerçek controller simülasyonunda iki sibling branch'in converge etmesi,
9. tekrarlı cross-tab event'lerinde write oscillation olmaması,
10. message-content/secret canary'nin lineage JSON'una girmemesi.

## Değişmeyen güvenlik sözleşmesi

Yeni endpoint, provider call, connector permission, memory write veya agent tool capability eklenmez. Dört profilli selector/specialist roster, backend default-deny ve external write/send/merge explicit approval sınırları aynen korunur. `.env`, credential dosyaları ve `.github/workflows/` bu değişikliğin kapsamı dışındadır.
