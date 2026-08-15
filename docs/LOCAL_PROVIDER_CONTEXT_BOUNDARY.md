# Local provider context boundary

Hafize'nin basit `/api/chat` yolu NVIDIA NIM'i ana sağlayıcı olarak korurken isteğe bağlı `local:` model seçimini desteklemeye hazırlanır. Context compaction ile inference provider seçimi birbirinden bağımsız güvenlik sınırlarıdır; local inference seçimi konuşma geçmişinin sessizce NVIDIA'ya özetletilmesine izin vermez.

## Güvenlik kararı

Varsayılan/legacy context compactor ile `local:` model seçilmiş bir sohbet compaction eşiğini aşarsa istek `LOCAL_CONTEXT_COMPACTION_UNAVAILABLE` ile fail-closed durur. Bu #140 davranışı geriye dönük güvenlik ağı olarak korunur.

Local context compaction yalnız açıkça `supportsLocalModels: true` sözleşmesi taşıyan provider-aware compactor enjekte edildiğinde açılır. Bu compactor:

- aynı `local:<model>` kimliğini provider completion katmanına geçirir;
- `toolsRequired: false` ile yalnız özetleme completion'ı ister;
- sonucu yalnız provider gerçekten `local` olarak döndüyse kabul eder;
- local provider başarısızsa NVIDIA/default summarizer'a fallback yapmaz;
- summary üretilemez veya token kazancı sağlanamazsa büyük local request'i `LOCAL_CONTEXT_COMPACTION_FAILED` ile fail-closed durdurur;
- AbortSignal'ı summary completion'a taşır ve iptal edilmiş request'i provider'a göndermez.

Kısa local sohbetler compaction eşiğinin altında kaldığı sürece summary çağrısı üretmez. NVIDIA modelleri mevcut default compactor/summarizer yolunu kullanmaya devam eder.

## Scoped summarizer override

`createContextCompactor()` artık `prepare(..., { summarize })` çağrısında request-scoped summarizer override kabul eder. Override yalnız o prepare çağrısı için geçerlidir; compactor'ın varsayılan summarizer'ını veya global provider seçimini değiştirmez.

`createModelProviderContextCompactor()` bu dar extension noktasını kullanır. Local modelde provider-aware summarizer'ı enjekte eder, NVIDIA modelinde base compactor'ı değiştirmeden çağırır. Böylece iki provider için paralel/tekrarlı compaction algoritması oluşturulmaz; token threshold, recent-message preservation ve summary-source limitleri tek `context-compaction` implementasyonunda kalır.

## Chat preparation sınırı

`model-provider-chat-preparation` gerçek `contextCompactor.thresholdTokens` değerini zorunlu composition kontratı olarak kullanır. Server-side system mesajı eklendikten sonra tahmini token sayısı eşik üzerindeyse:

- compactor `supportsLocalModels !== true` ise `LOCAL_CONTEXT_COMPACTION_UNAVAILABLE` oluşur;
- compactor local-capable ise request compactor'a geçer ve local summary başarıyla üretilmek zorundadır.

Bu capability flag prompt veya model çıktısından gelmez; backend composition nesnesinin immutable özelliğidir. Provider seçimi tool authorization veya yeni backend yetkisi sağlamaz.

## HTTP ve veri sınırı

Legacy guard mevcut sanitize edilmiş davranışı korur:

- status: `413`
- error: `LOCAL_CONTEXT_COMPACTION_UNAVAILABLE`
- cache: `no-store`

Provider-aware compaction başarısızlığında da ham provider response, model çıktısı, konuşma içeriği, credential, filesystem path veya exception detayı istemciye taşınmamalıdır. Production HTTP mapping ayrı wiring adımında bu yeni hata kodunu sabit/sanitize response'a çevirmelidir.

## Bilinçli sınırlar

Bu adım:

- `server.mjs` production route wiring'ini açmaz;
- provider-aware compactor'ı production singleton'a otomatik bağlamaz;
- local provider kapalıysa NVIDIA fallback yapmaz;
- model context limitini uzaktan tahmin etmez veya keyfi büyütmez;
- `/api/agent/run`, scheduler, screen analysis ya da agent/tool permission sözleşmesini değiştirmez;
- üçüncü taraf Jarvis kaynak kodunu kopyalamaz.

Production composition ileride `createModelProviderProductionRuntime().complete` ile bu compactor'ı bağladığında local provider explicit opt-in + loopback-only sınırı aynen korunmalıdır.

## Regresyon kapsamı

Canonical `scripts/test-*.mjs` discovery şu davranışları kilitler:

- uzun local context yalnız local provider completion ile özetlenir;
- default/NVIDIA summarizer local path'te çağrılmaz;
- provider mismatch, local failure ve boş summary fail-closed olur;
- pre-aborted local request provider completion başlatmaz;
- kısa local context summary isteği üretmez;
- NVIDIA context mevcut base summarizer yolunu korur;
- chat preparer local-capable compactor ile uzun local context'i kabul eder;
- legacy compactor enjekte edilirse #140 `LOCAL_CONTEXT_COMPACTION_UNAVAILABLE` guard'ı aynen çalışır.
