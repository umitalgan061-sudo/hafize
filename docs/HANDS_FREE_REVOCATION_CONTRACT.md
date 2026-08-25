# Hands-free revocation contract

Hafize hands-free / wake-phrase modu açık kullanıcı onayıyla başlar ve mikrofon göstergesi kullanıcıya görünür olduğu sürece çalışabilir. Uygulama görünür bağlamdan çıktığında aktif oturumun kapatılması bir gizlilik sınırıdır; yalnız UI durumu değildir.

## Amaç

Bu sözleşme background/focus lifecycle sinyali ile gerçek hands-free runtime arasındaki kapatma yolunu tanımlar. Guard mikrofon runtime'ını yeniden uygulamaz, recognizer referansı tutmaz ve kullanıcı düğmesine programatik tıklamayı üretim kapatma mekanizması olarak kullanmaz.

Canonical kapatma kanalı:

- event adı: `hafize:hands-free-revoke`
- yön: yalnız `enabled -> disabled`
- event payload'ı yetki veya kullanıcı onayı değildir
- event hiçbir koşulda hands-free özelliğini açamaz
- event active recognizer, restart/handoff/cooldown ve session timeout sahipliğini mevcut runtime `setEnabled(false)` yolu üzerinden temizler

## Neden disable-only?

Sayfa içindeki başka bir bileşenin hands-free runtime'a erişmesi gerekebilir; fakat genel bir `setState`, `enable` veya `toggle` event'i kullanıcı onayı sınırını zayıflatır. Revocation kanalı yalnız yetki azaltır. Event gönderen kod `enable: true`, `requestedState: enabled` veya benzeri alanlar taşısa bile runtime bunları yorumlamaz.

Hands-free yeniden yalnız görünür kullanıcı etkileşimiyle mevcut toggle/consent yolundan açılır. `visibilitychange`, `pageshow`, `focus` veya başka lifecycle dönüş sinyali otomatik enable üretmez.

## Background guard davranışı

`public/hands-free-background-guard.js` şu lifecycle sinyallerini yakalar:

- `visibilitychange` ve `document.hidden === true`
- `pagehide`
- `freeze`
- masaüstü/Electron bağlamı için `window.blur`

Gerçek DOM'da guard `document.dispatchEvent(...)` ile canonical revoke event'ini gönderir. Event dispatch senkrondur; runtime listener event dönüşünden önce hands-free state'ini kapatır. Guard daha sonra UI state'ini doğrular.

State hâlâ enabled görünüyorsa guard başarılı kapatma varmış gibi davranmaz. `data-background-revoked="revocation-failed"` yazar ve sonucu failure olarak tutar. Böylece controller listener'ının eksik olması, runtime'ın kurulmamış olması veya beklenmeyen entegrasyon hatası sessizce başarıya çevrilmez.

Minimal Node test harness'leri gerçek DOM `dispatchEvent` sağlamadığında eski `toggle.click()` simülasyonuna yalnız test-uyumluluk fallback'i vardır. Tarayıcı Document nesnesi `dispatchEvent` sağladığı için üretim yolunda bu fallback'e girilmez. Yeni entegrasyon testleri DOM yolunda `toggle.click()` çağrılırsa bilerek exception fırlatır.

## Revocation sonrası durum

Başarılı revocation şu invariants'ları korur:

1. `aria-pressed` false olur.
2. Runtime `isEnabled()` false döner.
3. Aktif SpeechRecognition instance abort edilir.
4. Session timeout temizlenir.
5. Restart timer temizlenir.
6. Handoff ve cooldown state temizlenir.
7. Görünür bağlama dönüş otomatik restart veya enable üretmez.
8. Guard revocation nedenini dar bir enum-benzeri string olarak UI attribute'unda tutar; credential veya konuşma içeriği yazmaz.

## Bildirim

Hidden/pagehide/freeze/window-blur kaynaklı revoke sonrasında kullanıcı uygulamaya geri geldiğinde tek seferlik görünür bildirim gösterilir. Bildirim, dinlemenin arka plana geçiş nedeniyle kapandığını ve yeniden açmak için fresh kullanıcı onayı gerektiğini söyler.

Bildirim gösterilemese bile mikrofon tekrar açılmaz. Toast kullanılabilirliği privacy boundary için prerequisite değildir.

## Event güvenliği

Revocation event'i secret, credential, transcript veya model içeriği taşımaz. Mevcut guard yalnız `source` ve dar `reason` metadata'sı gönderir. Runtime bu detail alanlarını authorization sinyali olarak kullanmaz; event'in varlığı yalnız kapatma talebidir.

Bu kanal provider-independent'tir. NVIDIA NIM, local/Ollama veya başka bir model sağlayıcısı hands-free izin durumunu değiştiremez. Tool permission ve model provider routing katmanları bu browser lifecycle sözleşmesinden ayrıdır.

## Failure davranışı

- Revoke event dispatch exception üretirse guard `revocation-failed` işaretler.
- Runtime listener yoksa enabled UI state değişmediği için guard failure işaretler.
- Guard kurulu ama hands-free zaten kapalıysa lifecycle sinyali no-op'tur.
- Guard destroy edildiğinde kendi listener'larını ve host-owned revocation attribute baseline'ını restore eder.
- Runtime destroy edildiğinde revoke listener kaldırılır; daha sonraki revoke event'leri host DOM state'ini değiştirmez.

## Kullanıcı onayı sınırı

Bu sözleşme hands-free açma davranışını genişletmez. Açma hâlâ mevcut görünür opt-in/toggle akışına bağlıdır. Background guard, revoke event'i veya başka bir lifecycle event'i fresh kullanıcı onayı yerine geçmez.

Özellikle aşağıdakiler yasaktır:

- page focus geri geldi diye otomatik enable
- hidden sekmede restart timer ile yeniden dinleme
- model/tool payload'ından hands-free onayı türetme
- storage/network üzerinden gizli reactivation
- background guard'ın generic toggle API'sine dönüşmesi

## Test DoD

Canonical `npm run check` auto-discovery zincirinde şu regresyonlar bulunur:

- runtime revoke event'i aktif oturumu kapatır ve recognizer'ı abort eder
- event payload'ındaki enable benzeri alanlar dikkate alınmaz
- real-DOM dispatch yolunda programatik toggle click çağrılmaz
- hidden, blur ve freeze revocation sonrası görünür/focus dönüşü auto-enable etmez
- runtime listener eksikse guard başarı taklidi yapmaz
- destroy listener ownership'ini serbest bırakır

## İleriye dönük değişiklikler

Yeni lifecycle nedeni eklenebilir; fakat revoke kanalı çift yönlü state controller'a dönüştürülmemelidir. Mikrofonu açan her yeni yol ayrı görünür kullanıcı onayı, erişilebilir UI durumu ve test kanıtı gerektirir.