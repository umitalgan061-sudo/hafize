# Conversation storage boundary

Hafize'nin tarayıcıda tuttuğu `hafize.conversations.v1` sohbet geçmişi uygulama verisidir; güvenilir bir schema kaynağı değildir. Eski sürüm, eklenti, bozuk storage, manuel düzenleme veya başka bir istemci bu değeri beklenmeyen biçimde bırakabilir. Bu nedenle `conversation-storage-guard.js` yerel geçmişi dar bir allowlist sözleşmesine göre normalize eder.

## Sınırlar

- En fazla **30 sohbet** tutulur.
- Sohbet başına en fazla **200 mesaj** kabul edilir.
- Mesaj metni en fazla **12.000 Unicode karakter**, başlık en fazla **80 karakter** olabilir.
- Yalnız `user` ve `assistant` rolleri kabul edilir. Storage içinden `system`, `tool` veya başka rol enjekte edilemez.
- Sohbet ve mesaj kimlikleri en fazla 120 karakterlik dar ASCII allowlist'inden geçer.
- Tarihler parse edilebilir ISO zamanlarına canonicalize edilir.
- Aynı sohbet veya mesaj ID'sinin ikinci örneği atılır.
- Tool activity yalnız assistant mesajında, en fazla dört kayıtla ve `running|success|failure` state allowlist'iyle tutulur.
- `ownerId`, `traceId`, token, credential, provider metadata veya gelecekte eklenmiş bilinmeyen alanlar allowlist dışında oldukları için yeni canonical storage'a taşınmaz.

## Güvenlik modeli

Bu katman HTML üretmez, mesajları yürütülebilir içerik olarak yorumlamaz ve network isteği yapmaz. Kullanıcı metnindeki `<script>` veya benzeri dizgeler düz metin olarak korunabilir; güvenli render sorumluluğu mevcut `textContent`/safe-markdown katmanında kalır.

Guard agent tool authorization değildir. NVIDIA/GitHub/Gmail/Canva izinleri, external write/send/merge onayları ve backend default-deny politikası değişmez.

## Migration davranışı

Guard `ui-shell.js` tarafından fixed same-origin `/conversation-storage-guard.js` asset'i olarak yüklenir. Storage canonical biçimdeyse hiçbir yazma veya reload yapılmaz. Invalid JSON ya da normalize edilmesi gereken veri varsa yalnız aynı `hafize.conversations.v1` anahtarı güncellenir.

Mevcut `app.js` guard'dan önce yüklenebildiği için normalize edilmiş storage'ın çekirdek state'e kesin olarak yansıması amacıyla ilk başarılı düzeltmeden sonra tek bir best-effort reload yapılır. `sessionStorage` içindeki kısa ömürlü marker aynı bozuk durumun reload loop üretmesini engeller. Marker sohbet içeriği içermez ve yalnız lifecycle kontrolü içindir. Session storage kullanılamıyorsa sanitization yine kalıcılaştırılır; reload yapılması zorunlu değildir.

Storage okuma veya yazma tarayıcı politikası/quota nedeniyle başarısızsa guard fail-closed davranır ve başka anahtarları silmez. Kullanıcı geçmişinin tamamını temizlemek için ayrı UI onayı gerektiren mevcut davranış korunur.

## PWA

Guard PWA shell cache'ine dahildir. Cache sürümü bu değişiklikte `hafize-shell-v89` olmuştur. `/api/*` istekleri service worker tarafından hâlâ network-only işlenir; sohbet geçmişi service-worker cache'ine taşınmaz.

## Test sözleşmesi

Regresyon testleri şunları kilitler:

- conversation/message sayı ve metin limitleri,
- duplicate ID davranışı,
- role ve state allowlist'leri,
- prototype üzerinden alan mirası reddi,
- unknown/secret canary alanlarının canonical çıktıdan silinmesi,
- invalid JSON ve storage failure davranışı,
- tek reload + reload-loop guard,
- fixed same-origin loader ve PWA v89 wiring'i,
- guard içinde network, HTML injection, cookie ve shell yürütme yüzeylerinin bulunmaması.

## Geri alma

Geri alma için `conversation-storage-guard.js`, ilgili testler ve bu belge kaldırılır; `ui-shell.js` loader kaydı silinir ve PWA shell asset/cache sürümü önceki değere döndürülür. Kalıcı backend schema migrasyonu yoktur.
