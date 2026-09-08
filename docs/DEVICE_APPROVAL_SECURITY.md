# Device approval security boundary

Hafize'nin masaüstü device bridge'i sistem bilgisi okumayı, HTTPS bağlantısı açmayı ve ürün allowlist'indeki uygulamaları açmayı destekler. Bu belge, model/ajan çağrısı ile gerçek cihaz yan etkisi arasındaki kullanıcı onayı sınırını tanımlar.

## Temel ilke

Modelin ürettiği tool arguments kullanıcı onayı değildir. `explicitUserIntent: true`, `approved: true` veya benzeri bir alan model tarafından üretilse bile masaüstü yan etkisi başlatılamaz.

Düşük seviye `device-bridge-contract` yalnız teknik komut doğrulamasıdır. Çağrı `device-bridge-tool-boundary` üzerinden agent registry'deki backend `toolPolicy` kararına tabidir. Model payload'ında `explicitUserIntent` alanı yoktur.

## Onay lease'i

Yan etki gerektiren browser/app eylemleri kısa ömürlü, tek-kullanımlık approval lease ile yürütülür. Lease `traceId`, `action` ve exact `target` alanlarına bağlıdır. Varsayılan ömür 60 saniye, azami ömür 5 dakikadır. Mismatch veya expired token tüketilir ve replay edilemez.

## Review session

Kullanıcı onayı server-side review session ile başlatılır. Exact hedef server-side tutulur; kullanıcı arayüzüne yalnız güvenli sunum döner.

Browser URL'sinde yalnız origin + pathname gösterilir. Query string ve fragment değerleri potansiyel token/state sızıntısını önlemek için gösterilmez. Exact ham URL server-side review kaydına bağlı kaldığından onay başka hedefe taşınamaz. App açmada normalize edilmiş allowlist `appId` gösterilir.

Review varsayılan 30 saniye, azami 60 saniyedir; tek kullanımlık ve explicit confirmation gerektirir. Yanlış trace, expiry veya cancel approval üretmez.

## Audit metadata

Review başlangıcı ve approval issuance için redacted audit event üretilebilir. Audit yalnız stage, traceId, action, sanitize edilmiş target, redaction bilgisi ve timestamp taşır. Approval token, raw query/fragment, URL credential, secret veya model içeriği audit'e girmez.

## Uygulama sırası

1. Model yalnız public tool request'i önerir.
2. Backend agent permission'ı default-deny olarak kontrol eder.
3. Yan etki için review session açılır.
4. Kullanıcı görünür UI'da açıkça onaylar.
5. Confirm tek-kullanımlık approval lease üretir.
6. Tool boundary lease'i exact trace/action/target ile consume eder.
7. Ancak bundan sonra backend `explicitUserIntent: true` değerini düşük seviye bridge'e ekler.
8. Bridge kendi HTTPS/app allowlist doğrulamasını tekrar yapar.

## Bilerek desteklenmeyenler

- raw shell veya terminal komutu,
- executable path çalıştırma,
- HTTP URL açma,
- URL credential kabulü,
- modelin approval/intent alanı üretmesi,
- persistent approval token saklama,
- token'ın modele/agent context'e aktarılması,
- kullanıcı onayı olmadan browser/app yan etkisi.

## Provider bağımsızlığı

NVIDIA NIM ana provider'dır. Local/Ollama veya başka provider seçimi device permission contract'ını değiştirmez. Authorization, review, approval lease ve bridge execution backend/runtime sınırında kalır.
