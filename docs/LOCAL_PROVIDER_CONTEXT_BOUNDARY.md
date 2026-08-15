# Local provider context boundary

Hafize'nin basit `/api/chat` yolu NVIDIA NIM'i ana sağlayıcı olarak korurken isteğe bağlı `local:` model seçimini desteklemeye hazırlanır. Context compaction ise halen NVIDIA tabanlı bir özetleyici kullanır. Bu iki katman birbirinden bağımsız yetki ve sağlayıcı sınırlarıdır.

## Güvenlik kararı

`local:` model seçilmiş bir sohbet, compaction eşiğini aşarsa Hafize konuşma geçmişini sessizce NVIDIA'ya özetletmez. İstek `LOCAL_CONTEXT_COMPACTION_UNAVAILABLE` ile fail-closed durur.

Bu davranış bilinçlidir:

- local model seçimi kullanıcının inference sağlayıcısı tercihidir;
- uzun geçmişi NVIDIA'ya göndererek bu tercihi sessizce aşmak doğru değildir;
- local sağlayıcının kendi context window kapasitesini tahmin ederek sınırsız payload göndermek de güvenli değildir;
- provider seçimi tool authorization veya yeni backend yetkisi sağlamaz.

Kısa local sohbetler mevcut compaction eşiğinin altında kaldığı sürece normal şekilde local provider'a gönderilebilir. NVIDIA modellerinde mevcut context compaction davranışı değişmez.

## Uygulama sınırı

`model-provider-chat-preparation` gerçek `contextCompactor.thresholdTokens` değerini zorunlu composition kontratı olarak kullanır. Server-side system mesajı eklendikten sonra tahmini token sayısı eşik üzerindeyse ve model kimliği tam olarak `local:` prefix'i ile başlıyorsa compactor çağrılmadan önce request reddedilir.

Bu kontrol özellikle compactor'ın `summarize({ model, ... })` callback'ine `local:*` model kimliği ulaşmasını engeller. Mevcut production compactor bu callback'i NVIDIA JSON completion üzerinden çalıştırdığı için guard olmadan uzun local konuşma yanlış sağlayıcıya yönlenebilirdi.

## HTTP davranışı

HTTP boundary bu durumu sanitize edilmiş sabit cevap olarak taşır:

- status: `413`
- error: `LOCAL_CONTEXT_COMPACTION_UNAVAILABLE`
- cache: `no-store`

Model kimliği, konuşma içeriği, provider body, credential, filesystem path veya internal exception detayı hata cevabına eklenmez. Guard tetiklendiğinde `provider.stream()` çağrılmaz.

## Bilinçli olarak yapılmayanlar

Bu adım:

- local konuşma geçmişini NVIDIA'ya otomatik aktarmıyor;
- yeni bir local summarizer üretmiyor;
- context limitini keyfi büyütmüyor;
- `server.mjs` production route wiring'ini açmıyor;
- `/api/agent/run`, scheduler, screen analysis veya context summarizer provider'ını değiştirmiyor;
- agent/tool permission sözleşmesini değiştirmiyor.

İleride local context compaction açılacaksa ayrı bir provider-aware summarizer sözleşmesi, model context limit bilgisi, cancellation, error sanitization ve açık regresyon testleriyle yapılmalıdır. NVIDIA fallback sessiz varsayılan olmamalıdır.

## Regresyon kapsamı

Canonical `scripts/test-*.mjs` discovery şu davranışları kilitler:

- kısa `local:` sohbet compactor üzerinden geçebilir fakat summary çağrısı üretmez;
- eşik üstü `local:` sohbet compactor veya provider stream'e ulaşmadan 413 ile durur;
- aynı büyük sohbet NVIDIA modelinde mevcut compaction yolunu kullanır;
- yalnız exact `local:` prefix'i provider sınırı sayılır;
- invalid compactor threshold composition sırasında fail-closed reddedilir;
- abort edilmiş request guard/compactor işleminden önce cancellation üretir.
