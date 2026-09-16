# TypeScript browser security model

Bu belge, typed frontend dalgasında uygulanan güvenlik sınırlarını tanımlar.

## Kimlik doğrulama

Kimlik doğrulama `auth.ts` içinde tek bir browser boundary olarak ele alınır. Uygulama API çağrıları same-origin ile sınırlandırılır. Oturum endpoint'leri auth wrapper'dan hariç tutulur.

Başarılı session cevabındaki CSRF değeri yalnız çalışma belleğindeki state'te tutulur. Browser storage'a auth token veya bearer credential yazılmaz.

State-changing API istekleri `X-Hafize-CSRF` header'ı ile gönderilir. GET/HEAD istekleri gereksiz CSRF header'ı taşımaz.

401 cevabı alındığında auth state temizlenir, session yenilenir ve istek bir kez tekrar edilir. Sonsuz retry döngüsü tasarlanmaz.

## DOM sınırı

Kullanıcı veya sunucu kaynaklı metinler HTML fragment olarak yorumlanmaz. Typed modüller `textContent`, `.value`, `dataset` ve kontrollü attribute yazımları kullanır.

`innerHTML`, `outerHTML`, `document.write` ve string tabanlı event handler üretimi kullanılmaz.

Dynamically created buttons explicit `type="button"` kullanır; form içinde istemeden submit üreten button riski azaltılır.

## Dosya ve ekran erişimi

Composer dosya eklemesi yalnız belirlenmiş metin/kod uzantılarını kabul eder, boyutu sınırlar ve içeriği tarayıcıda okur. Ayrı bir upload API'sine otomatik dosya gönderimi yoktur.

Ekran paylaşımı yalnız açık kullanıcı etkileşimi sonrasında `getDisplayMedia` çağırır. Ses capture edilmez. Frame boyutu 1280×720 ile sınırlandırılır ve capture bittikten sonra bütün media track'leri durdurulur.

Object URL'ler kullanım bittiğinde revoke edilir.

## Ses API'leri

Speech Recognition ve Speech Synthesis opsiyonel capability'lerdir. API bulunmadığında ana sohbet akışı kullanılabilir kalır.

Eller serbest özelliğinde 30 dakikalık session timeout bulunur. Ağ hatalarında bounded retry delay uygulanır. Mikrofon veya güvenlik hatalarında özellik kapatılır.

## Local storage

Kayıtların her biri normalize edilir ve üst sınır uygulanır. JSON parse hatası boş/fallback state ile sonuçlanır.

Storage dolu veya erişilemez olduğunda UI hata mesajı verir; ana sohbetin çökmesine neden olmaz.

Diagnostik kayıtları da bounded storage yaklaşımını kullanır ve telemetry endpoint'i içermez.

## Scheduled tasks

Schedule UI authenticated same-origin API kullanır. DELETE işlemleri açık kullanıcı onayı sonrası yapılır. API cevapları service worker shell cache'e alınmaz.

UI server ownership, authorization veya credential policy'yi yeniden uygulamaz; backend'in güvenlik kararları korunur.

## Event lifecycle

Typed modüller `Disposer` kullanarak listener cleanup sağlar. MutationObserver ve timer yaşam döngüleri destroy sırasında kapatılır.

Aynı özelliğin iki runtime tarafından aynı DOM'a bağlanması duplicate listener ve state collision oluşturabileceği için migration sonrası legacy entry kaldırılır.

## Runtime diagnostics

`runtime-health.ts` yalnız local snapshot üretir. Online/offline, visibility, runtime error ve unhandled rejection sinyalleri local event listesinde bounded biçimde tutulur.

Diagnostics içinde secret, auth token, message content veya credential kaydı yapılmamalıdır.

## Threat model özeti

En önemli istemci tehditleri: yanlış origin'e API gönderimi, credential'ın storage'a düşmesi, DOM injection, aşırı büyük local state, sonsuz retry, unutulmuş media stream ve duplicate event listener'dır.

Typed platform primitives bu tehditlerin her biri için ortak bir enforcement noktası sağlar.

## Review checklist

Kod incelemesinde aynı beş soru her modül için sorulmalıdır: veri nereden geliyor, hangi boundary'den geçiyor, storage'a yazılıyor mu, hangi event/timer cleanup ediliyor, optional browser API yoksa davranış ne oluyor?

Bu sorulardan biri cevapsızsa modül production-ready kabul edilmemelidir.
