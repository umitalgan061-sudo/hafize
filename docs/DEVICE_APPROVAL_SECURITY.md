# Device approval security boundary

Hafize'nin masaüstü device bridge'i sistem bilgisi okumayı, HTTPS bağlantısı açmayı ve ürün allowlist'indeki uygulamaları açmayı destekler. Bu belge, model/ajan çağrısı ile gerçek cihaz yan etkisi arasındaki kullanıcı onayı sınırını tanımlar.

## Temel ilke

Modelin ürettiği tool arguments kullanıcı onayı değildir. Özellikle `explicitUserIntent: true`, `approved: true` veya benzeri bir alan model tarafından üretildi diye hiçbir masaüstü yan etkisi başlatılamaz.

Düşük seviye `device-bridge-contract` yalnız teknik komut doğrulamasıdır. Model/provider tarafındaki çağrı önce `device-bridge-tool-boundary` içinden geçer. Bu boundary agent registry'deki backend `toolPolicy` kararını uygular ve model payload'ında `explicitUserIntent` alanını tamamen yasaklar.

## İzinler

- `device.system.info`: salt-okunur, ana Hafize ajanında allowlist.
- `device.browser.open`: approval required.
- `device.app.open`: approval required.

Diğer ajanlar bu izinleri miras almaz. Registry `default: deny` olarak kalır. Yeni provider eklemek bu policy'yi değiştirmez.

## Onay lease'i

Tercih edilen runtime akışı tek-kullanımlık approval lease kullanır. Lease process memory'de tutulur ve şu alanlara bağlanır:

- `traceId`
- `action`
- exact `target`

Browser için target tam HTTPS URL'dir; app açma için normalize edilmiş `appId`'dir. Bir lease başka trace, action veya target ile sunulursa reddedilir ve token tüketilir. Böylece yanlış hedef denemesi sonrasında aynı token tekrar kullanılamaz.

Lease varsayılan 60 saniye yaşar ve 5 dakikadan uzun olamaz. Expired veya revoke edilmiş lease yan etki üretemez.

Lease token credential değildir; yine de agent prompt'una, modele, persistent memory'ye veya kullanıcıya gösterilen audit payload'ına eklenmez.

## Review session

Kullanıcı onayı için server-side review session kullanılır. Review session exact target'ı server-side bellekte tutar, fakat kullanıcıya yalnız güvenli sunum döndürür.

Browser URL'sinde origin + pathname görünür. Query string ve fragment değerleri onay ekranında gösterilmez; bunlar access token, state veya başka hassas değer taşıyabilir. Review yine exact ham target'a bağlı olduğundan kullanıcı onayı başka URL'ye taşınamaz.

App açma review'u normalize edilmiş allowlist `appId` değerini gösterir.

Review session:

- varsayılan 30 saniye,
- en fazla 60 saniye,
- tek kullanımlık,
- explicit confirmation gerektiren,
- trace-bound bir sözleşmedir.

Yanlış trace ile confirm denemesi review'u tüketir. Expired veya cancel edilmiş review approval lease üretemez.

## Audit metadata

Review başlangıcı ve approval issuance için redacted audit metadata üretilebilir. Audit olayı yalnız şu tip güvenli alanları taşır:

- stage,
- traceId,
- action,
- sanitize edilmiş target,
- query/fragment redaction bilgisi,
- timestamp.

Approval token, raw query, URL credential, secret veya model içeriği audit event'e girmez. Bu metadata ortak trace/task-ledger gözlemlenebilirlik yaklaşımına bağlanabilir.

## Uygulama sırası

Desktop runtime bağlanırken önerilen akış:

1. Model yalnız action'ın public tool schema'sını görür.
2. Backend agent permission'ı default-deny olarak kontrol eder.
3. Yan etki gerekiyorsa server-side review session oluşturulur.
4. Kullanıcı görünür UI'da açıkça onaylar.
5. Confirm tek-kullanımlık approval lease üretir.
6. Tool boundary lease'i exact trace/action/target ile consume eder.
7. Ancak bundan sonra düşük seviye bridge'e `explicitUserIntent: true` backend tarafından eklenir.
8. Bridge HTTPS/app allowlist sınırını tekrar doğrular ve eylemi gerçekleştirir.

Bu iki katmanlı doğrulama bilinçlidir: tool boundary authorization/approval sınırıdır; device bridge ise işletim sistemi capability sınırıdır.

## Bilerek desteklenmeyenler

- raw shell veya terminal komutu,
- executable path çalıştırma,
- deny-list tabanlı command güvenliği,
- HTTP URL açma,
- URL credential kabulü,
- modelin approval/intent alanı üretmesi,
- persistent approval token saklama,
- approval token'ın modele veya agent context'e verilmesi,
- kullanıcı onayı olmadan browser/app yan etkisi,
- dış mesaj/gönderme veya repo merge yetkisinin bu bridge üzerinden dolaylı açılması.

## Provider bağımsızlığı

NVIDIA NIM ana sağlayıcı olarak kalır. Local/Ollama veya başka provider seçimi device permission contract'ını değiştirmez. Provider yalnız tool isteği önerebilir; authorization, review, approval lease ve bridge execution kararları backend/runtime'a aittir.

## Geri alma

Bu katman persistent schema migration içermez. Review/lease store process memory'dedir. İlgili modüller ve registry permission satırları bağımsız revert edilebilir; düşük seviye device bridge contract'ı ayrı kalır.
