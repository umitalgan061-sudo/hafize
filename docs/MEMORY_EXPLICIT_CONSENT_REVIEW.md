# Memory Explicit Consent Review

## Amaç

Kişisel bellek kalıcı ve kullanıcıya özgü veri taşıdığı için, formdaki ilk `Kaydet` eylemi doğrudan ağ yazısı üretmemelidir. Bu katman mevcut güvenli memory API'sini değiştirmeden kullanıcıya ikinci, ayrı bir gözden geçirme/onay adımı verir.

## Yazma akışı

1. Kullanıcı bellek türünü ve içeriğini yazar.
2. İlk form submit'i capture aşamasında durdurulur; POST yapılmaz.
3. Hafize yalnız türü, karakter sayısını ve en fazla 240 karakterlik düz metin önizlemesini gösterir.
4. Kullanıcı `Onayla ve kaydet` düğmesine ayrıca basarsa, tür ve içerik review anındaki exact değerlerle aynı olduğu sürece mevcut `memory-ui.js` submit yolu bir kez serbest bırakılır.
5. Tür veya içerik değişirse hazırlanmış review geçersizleşir ve yeniden onay gerekir.

Review içeriği yalnız sayfa belleği/DOM içinde geçicidir. Yeni localStorage, sessionStorage, IndexedDB, cookie veya backend taslak kaydı yoktur.

## Silme akışı

Bellek kaydındaki ilk `Sil` tıklaması DELETE üretmez. Düğme sekiz saniyelik `Tekrar tıkla: sil` durumuna geçer. Aynı kayıt bu süre içinde ikinci kez tıklanırsa mevcut `memory-ui.js` DELETE yolu serbest bırakılır.

Sekiz saniye dolması, Escape, başka bir silme hedefinin seçilmesi veya controller destroy edilmesi pending teyidi iptal eder. Silme hedefi exact `memory_*` kimlik allowlist'inden geçmelidir.

## Backend güvenlik sınırı

Bu UI yetkilendirme katmanı değildir. Mevcut personal-memory server runtime değişmeden kalır:

- Mutation işlemleri authenticated owner'a bağlıdır.
- Server-side mutation guard güvenli origin kararını uygular.
- Write body `explicitUserIntent`, `sourceType` ve `sensitivity` sözleşmesini doğrular.
- Tek kayıt silme exact memory kimliğine bağlıdır.
- UI hiçbir owner kimliği, session cookie, signing key veya başka credential üretmez/okumaz.

## Veri minimizasyonu

Review paneli tam içeriğin ikinci kalıcı kopyasını oluşturmaz. Ekranda en fazla 240 karakterlik preview gösterilir; exact içerik yalnız mevcut textarea ve kısa ömürlü JavaScript snapshot'ında bulunur. Render yalnız `textContent` kullanır; HTML parse edilmez.

Enhancement doğrudan `/api/memory` çağrısı yapmaz. Ağ işlemlerini mevcut testli `memory-ui.js` client'ına bırakır. Böylece authentication, origin, request body ve hata davranışı için ikinci bir paralel istemci oluşmaz.

## Erişilebilirlik ve mobil

Review bölümü gerçek düğmeler kullanır. Confirm aşamasında focus onay düğmesine taşınır; Escape review'u iptal edip odağı textarea'ya döndürür. Mobilde review ve silme teyit hedefleri en az 44px'tir. `prefers-reduced-motion` ve forced-colors davranışları korunur.

## Geri alma

Revert için `memory-consent-review.js`, `memory-consent-review.css`, ilgili testler, bu belge ve chat-run/PWA wiring kaldırılır. Personal memory API, kayıtlı bellek verisi ve kalıcı schema için migrasyon gerekmez.
