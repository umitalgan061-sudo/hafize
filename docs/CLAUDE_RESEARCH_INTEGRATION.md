# Claude / Agency Agents / Jarvis araştırma entegrasyon kararı

İnceleme tarihi: 2026-08-14.

## İncelenen kaynaklar

- `chauncygu/collection-claude-code-source-code`
- `msitarzewski/agency-agents`
- `alpunlu12-commits/jarvis`

Bu belge üçüncü taraf kaynak kodunu topluca taşımak için değil, Hafize'ye uygulanacak ürün ve mimari davranışlarını kaydetmek için tutulur. Claude araştırma deposundaki raw/decompile edilmiş özgün kaynak dosyaları Hafize'ye kopyalanmaz; clean-room örnekler ve mimari açıklamalardan çıkarılan davranışlar Hafize'nin kendi JavaScript mimarisi ve testleriyle yeniden uygulanır.

## Claude araştırmasından alınacak yüksek değerli fikirler

### 1. Otomatik context compaction

Uzun konuşmalarda context dolmadan önce eski konuşma bölümü özetlenir, son mesajlar aynen korunur ve devam eden istek yeni özet + yakın geçmiş ile yürütülür.

Hafize uyarlaması:
- sistem mesajı hiçbir zaman özet kaynağına dahil edilmez;
- özet system yetkisi kazanmaz, user-level veri olarak kalır;
- özet çağrısında harici talimatlar veri kabul edilir;
- compaction görünür token metadata üretir;
- summary başarısızsa orijinal konuşma korunur;
- HTTP isteği iptal edilirse summary çağrısı da iptal edilir.

İlk uygulama `lib/context-compaction.mjs` ve server wiring ile başlatıldı.

### 2. Skills registry

Claude-benzeri skill yaklaşımında bir skill'in adı, açıklaması, tetikleyicileri, izin verilen araçları, argümanları, model tercihi ve execution context'i ayrı sözleşmelerdir.

Hafize uyarlaması:
- builtin / user / project kaynak önceliği;
- strict manifest doğrulaması;
- `inline` ve `fork` execution ayrımı;
- skill kendi tool yetkisini yükseltemez;
- skill prompt'u secret veya credential alamaz;
- project skill yalnız açıkça izin verilen proje kapsamından yüklenir.

Manifest sözleşmesi, kaynak önceliği ve execution planı `lib/skills-registry.mjs` ile uygulandı; ayrıntı `docs/SKILLS_REGISTRY.md`. Sıradaki adım bu registry'nin agent runtime ve server tarafına bağlanmasıdır.

### 3. Sub-agent lifecycle

Araştırılan multi-agent tasarımında task lifecycle, concurrency sınırı, max depth, cancellation, isimle mesaj gönderme ve worktree izolasyonu öne çıkıyor.

Hafize'de mevcut trace/task-ledger/delegation sistemi korunacak. Eklenecek boşluklar:
- explicit cancellation state;
- bounded concurrent child task yönetimi;
- tamamlanmış ajana mesaj gönderimini reddetme;
- branch/worktree benzeri izolasyonu yalnız GitHub yazma onayı verilmiş kod görevlerinde açma;
- child agent'ın parent tool yetkilerini otomatik miras almaması.

### 4. Permission ve tool görünürlüğü

Claude tarafındaki farklı permission modlarından Hafize'ye `bypass` yaklaşımı alınmayacak. Hafize backend default-deny modelini korur. Model yalnız gerçekten kullanılabilir ve agent policy tarafından izinli araçları görür.

### 5. Memory consolidation

Araştırma deposunda memory store, context, scan ve consolidation ayrı sorumluluklar olarak ele alınıyor. Hafize'nin mevcut owner-scoped encrypted memory sistemi korunacak; sonraki aşamada yalnız kullanıcı kontrollü kayıtları periyodik olarak birleştiren ve tekrarları azaltan güvenli consolidation katmanı değerlendirilecek.

## Agency Agents tekrar taraması

Güncel katalogda Privacy Engineer, RAG Pipeline Engineer, UI Finish-Gate Reviewer, Codebase Archaeologist, AI-generated code security auditor ve credential hygiene gibi Hafize için yararlı uzmanlıklar bulunuyor.

Bunlar şu aşamada yeni ajan olarak topluca eklenmeyecek. Bunun yerine mevcut `agency-code-reviewer` ve `agency-minimal-engineer` kalite sözleşmelerine ölçülebilir gate fikirleri taşınacak: privacy/data minimization, retrieval evidence, anti-generic UI finish kontrolü, secret hygiene ve güvenlik regresyon kontrolü.

## Jarvis tekrar taraması

Güncel Jarvis özellik listesinde voice, ekran analizi, takvim/hatırlatıcı, medya, tarayıcı, uygulama açma, sistem bilgisi ve kalıcı bellek birlikte sunuluyor.

Hafize'de voice, screen-share, device bridge, local provider, hands-free ve encrypted memory temelleri zaten ayrı güvenlik sınırlarıyla ele alındı. Sonraki yeni ürün boşluğu calendar/reminder connector'dır. Yazma yapan reminder/calendar işlemleri `external.write` onayı olmadan çalışmayacaktır.

## Uygulama sırası

1. Context compaction ve gözlemlenebilirlik.
2. Strict skills manifest + registry + inline/fork execution contract.
3. Sub-agent cancellation/concurrency/message lifecycle.
4. Memory consolidation ve retrieval kalite ölçümleri.
5. Calendar/reminder read-first connector; write işlemleri explicit approval ile.
6. Reviewer kalite gate'lerine privacy, RAG evidence, UI finish ve credential hygiene ekleme.

Bu sıra NVIDIA NIM'i ana sağlayıcı, tool authorization'ı provider-independent ve backend default-deny tutar.
