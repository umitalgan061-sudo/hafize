# Hafize TypeScript mimarisi

Bu turda tarayıcı katmanının kritik runtime yüzeyi TypeScript'e taşındı. Amaç mevcut davranışı tek seferde yeniden yazmak değil; typed sınırlar, ortak yardımcılar, modül yaşam döngüsü ve build çıktısı üzerinden kontrollü bir geçiş oluşturmaktır.

## Neden TypeScript?

Hafize'nin tarayıcı tarafında çok sayıda bağımsız özellik bulunuyor: kimlik doğrulama, composer, taslaklar, sohbet geçmişi, scheduled tasks, sesli giriş/çıkış, eller serbest, ekran paylaşımı, ayarlar ve workspace navigasyonu. Bu modüllerin ortak problemi DOM, Browser API ve localStorage ile yoğun etkileşimdir.

TypeScript geçişi şu amaçlara hizmet eder:

- DOM elemanlarının ve event payload'larının açık tiplerle ifade edilmesi.
- `null`/`undefined` durumlarının daha erken yakalanması.
- Browser API erişiminin ortak yardımcılar üzerinden standartlaştırılması.
- State controller'larının geri dönüş tiplerinin sabitlenmesi.
- Build çıktılarının tek bir Vite entry tablosundan üretilebilmesi.
- Yeni özelliklerde aynı güvenlik ve lifecycle kalıplarının yeniden kullanılması.

## Katmanlar

### Browser platform

`public/typed/browser-platform.ts` ortak alt yapıdır. `Disposer`, event registration, güvenli query, text node üretimi, bounded text, same-origin URL kontrolü, safe JSON, safe storage ve timeout signal yardımcılarını sağlar.

Bu katmanın amacı özellik mantığı ile browser ayrıntıları arasında küçük ve test edilebilir bir sınır oluşturmaktır.

### Domain/runtime modülleri

Her büyük özellik kendi dosyasına sahiptir:

`auth.ts`
Kimlik doğrulama oturumunu kontrol eder, korumalı API çağrılarına CSRF header ekler ve 401 sonrası tek kontrollü yenileme yapar.

`chat-composer-features.ts`
Dosya okuma, sürükle-bırak, yapıştırma, yanıt kopyalama ve retry/edit yüzeylerini yönetir.

`chat-drafts.ts`
Yerel taslak kaydı, bounded storage ve page lifecycle davranışını yönetir.

`chat-history-search.ts`
Sohbet aramasını ve klavye kısayolunu yönetir.

`chat-history-management.ts`
Pin/rename gibi geçmiş yönetim işlemlerini yönetir.

`chat-history-export.ts`
Markdown ve JSON dışa aktarma işlemlerini yerelde üretir.

`composer-history.ts`
Composer geçmişini saklar ve klavye ile geçmişte gezinir.

`conversation-workspace.ts`
Conversation filter/sort/selection state'ini yönetir.

`scheduled-tasks.ts`
Schedule API ile authenticated CRUD sınırını yönetir.

`voice-input.ts`
Speech Recognition API için kontrollü bir browser adaptörüdür.

`voice-output.ts`
Speech Synthesis API için metin temizleme, chunking ve playback state yönetir.

`hands-free.ts`
Wake phrase, retry/backoff, session timeout ve voice handoff state'ini yönetir.

`screen-share.ts`
GetDisplayMedia izin akışı, frame bounding ve stream cleanup sağlar.

`settings-workspace.ts`
Yerel kullanıcı tercihleri ile ayarlar yüzeyini yönetir.

`ui-shell.ts`
Tema, calendar keyboard navigation, sidebar disclosure ve temel erişilebilirlik davranışlarını yönetir.

`workspace-navigation.ts`
Workspace değişimini, aktif navigation semantiğini ve card visibility state'ini yönetir.

`runtime-health.ts`
Browser runtime'ın local diagnostics katmanıdır. Telemetry veya uzak analytics göndermez.

## Build modeli

`vite.config.ts` typed entry listesini tek yerde tutar. Development sırasında `/typed-build/*.js` referansları gerçek `.ts` modüllerine çevrilir. Production build ise Vite/Rollup üzerinden ES module çıktıları üretir.

Girdi ve çıktıların aynı sözleşmeden üretilmesi, HTML ile build config arasındaki unutulmuş entry riskini azaltır.

## Legacy geçiş modeli

Bir modül TypeScript'e taşındığında şu sıra izlenir:

1. Legacy behavior okunur.
2. Shared browser primitive bulunur veya eklenir.
3. Public testable helper'lar çıkarılır.
4. TypeScript implementation yazılır.
5. Generated entry build'e eklenir.
6. `index.html` yalnız generated runtime'ı yükleyecek şekilde değiştirilir.
7. Service Worker shell cache güncellenir.
8. Legacy script'in duplicate yüklenmesi engellenir.
9. Source-contract ve behavior testleri eklenir.
10. Rollback yolu PR açıklamasında belirtilir.

## State yönetimi

Her controller kendi state'ini closure içinde tutar. Dışarıya yalnız gerekli read/mutate operasyonları açılır. Mutable implementation nesneleri `Object.freeze` ile sabit public yüzey haline getirilir.

Global window exports yalnız legacy entegrasyonunun gerçekten gerektiği yerlerde bulunur. Yeni state storage için ayrı key kullanılmalı ve mevcut veri şeması izinsiz değiştirilmemelidir.

## DOM güvenliği

Dinamik kullanıcı verisi `textContent`, `.value`, `dataset` veya kontrollü attribute yazımlarıyla eklenir. `innerHTML`, `outerHTML` ve string tabanlı HTML interpolation kullanılmaz.

Event listener lifecycle'ı `Disposer` üzerinden toplu olarak temizlenir. MutationObserver kullanılan modüller `destroy()` veya disposer kapanışında disconnect edilir.

## Browser capability policy

Browser API'ler capability-first ele alınır:

- SpeechRecognition yoksa yazılı giriş çalışmaya devam eder.
- SpeechSynthesis yoksa sesli yanıt özelliği pasif kalır.
- getDisplayMedia yoksa ekran paylaşımı açıklanabilir bir hata verir.
- localStorage bozulursa bounded fallback kullanılır.
- Clipboard API başarısız olursa güvenli textarea copy fallback'i denenir.

Hiçbir optional API yokluğu sohbetin ana composer akışını bloklamamalıdır.

## Network policy

Typed frontend modülleri yalnız kullanıcıya zaten açık olan same-origin API sınırlarını kullanır. API çağrıları service worker shell cache'e alınmaz. Browser diagnostics modülü ağ isteği yapmaz.

Authentication boundary `Authorization` credential'larını localStorage'a bırakmaz; oturum cookie tabanlıdır ve state-changing çağrılarda CSRF header eklenir.

## Performance policy

Typed module'ler küçük entry'ler olarak bundle edilir. Ağır DOM taramaları MutationObserver ile ihtiyaç olduğunda tetiklenir. UI refresh işlemleri mümkün olduğunca batch edilir. Ses çıktısı chunk'lanır; ekran capture boyutu sınırlandırılır.

## Test stratejisi

Her modül en az bir source/contract testine sahip olmalıdır. Kritik saf fonksiyonlar behavior testiyle, runtime glue ise source-contract testiyle kontrol edilir.

Testler iki amaç taşır: davranış regressionsını yakalamak ve yanlış bir yeniden yazımın güvenlik/lifecycle sözleşmesini kırmasını engellemek.

## Gelecek geçişler

Sonraki dalgalarda remaining legacy modules aynı pattern ile taşınabilir. Her wave bağımsız PR olmalı, base→head diff ayrı ölçülmeli ve eski entry yalnız yeni implementation doğrulandıktan sonra kaldırılmalıdır.
