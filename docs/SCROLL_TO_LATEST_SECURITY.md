# Scroll-to-latest UX and lifecycle boundary

Hafize uzun veya streaming sohbetlerde kullanıcının okuma konumuna saygı gösterir. Bu controller yalnız görünüm konumunu yönetir; sohbet verisini, mesaj içeriğini veya provider bağlamını okuyamaz.

## Kullanıcı davranışı

- Kullanıcı sohbetin en altına **96 piksel** içinde ise ekran `pinned` kabul edilir.
- Pinned durumda yeni mesaj veya streaming metin değişikliği geldiğinde görünüm en alta `auto` davranışıyla takip eder.
- Kullanıcı yukarı kaydırdıysa yeni içerik onu zorla aşağı kaydırmaz.
- Bu durumda kontrol önce `En alta git`, yeni içerik geldikten sonra `Yeni yanıt` olarak gösterilir.
- Yalnız kullanıcının kontrolü tıklaması smooth scroll başlatabilir.
- `prefers-reduced-motion: reduce` etkinse explicit tıklamada dahi `auto` kullanılır.
- `window.scrollTo` başarısız olursa controller fail-closed döner; pinned/unseen state başarısız scroll yapılmış gibi ilerletilmez.

## Veri sınırı

Controller yalnız scroll metriklerini ve `#messages` içindeki DOM mutation sinyallerini gözler.

- Mesaj içeriği okunmaz, kopyalanmaz veya indekslenmez.
- `.content`, `data-message-id`, tool activity veya trace metadata okunmaz.
- `localStorage`, `sessionStorage`, cookie, clipboard, fetch veya WebSocket kullanılmaz.
- Credential, owner ID, OAuth verisi veya provider secret controller'a girmez.
- MutationObserver yalnız içerik değişti sinyalini kullanır; değişen node'un metnini incelemez.

## Tek-controller ownership

Aynı `document` üzerinde aynı anda yalnız bir scroll-to-latest controller aktif olabilir.

- Ownership process-memory içindeki `WeakSet` ile tutulur; DOM marker'a veya prompt metnine güvenilmez.
- İkinci controller aynı document üzerinde mount etmeye çalışırsa fail-closed `false` döner ve listener/observer eklemez.
- Başarılı controller destroy edildiğinde ownership serbest bırakılır ve yeni controller temiz biçimde mount olabilir.
- Controller'ın kendi `destroy()` sonrasında yeniden mount edilmesine izin verilmez; yeni lifecycle için yeni controller instance gerekir.
- Public callback/metotlar ownership kaybedilmiş veya destroy edilmiş controller üzerinde inert kalır.

Bu sınır, iki controller'ın aynı butonu ve scroll state'ini yarış halinde değiştirmesini engeller.

## Host-owned button sözleşmesi

Controller `#scrollToLatestBtn` zaten DOM'da varsa düğmeyi ödünç alır; sahipliğini devralmaz.

Mount öncesinde şu alanlar snapshot edilir:

- `hidden`,
- `textContent`,
- `data-state` alanının hem değeri hem de mevcut olup olmadığı,
- `aria-label`.

Destroy veya başarısız installation rollback sonrasında bu alanlar exact restore edilir. Host'ta başlangıçta `data-state` veya `aria-label` yoksa teardown bunları boş string olarak bırakmaz; tekrar gerçekten absent hale getirir. Host-owned düğme DOM'dan kaldırılmaz.

Controller düğmeyi kendisi oluşturduysa yalnız o instance onu kaldırabilir. Click listener her iki durumda da exact handler referansıyla teardown sırasında sökülür.

## Atomik installation ve rollback

Mount, tek bir atomik installation olarak ele alınır. Aşağıdakilerden herhangi biri hata verirse controller yarım kurulmuş durumda kalmaz:

- style oluşturma/append,
- button oluşturma,
- button click listener kurulumu,
- passive window scroll listener kurulumu,
- MutationObserver constructor,
- `observer.observe`,
- ilk `requestAnimationFrame` scheduling.

Rollback sırası observable yan etki bırakmayacak şekilde uygulanır:

1. lifecycle generation ilerletilir ve mounted state kapatılır;
2. observer disconnect edilir;
3. kurulmuş listener'lar ters sırayla sökülür;
4. pending RAF best-effort iptal edilir;
5. controller-owned button kaldırılır veya host button exact restore edilir;
6. bu mount sırasında oluşturulan style kaldırılır;
7. document ownership serbest bırakılır.

Cleanup adımlarından birinin ayrıca hata vermesi diğer cleanup adımlarını engellemez.

## RAF ve stale callback sınırı

Her scheduled measurement controller generation'ını snapshot eder.

- Callback çalıştığında controller hâlâ canlı ve aynı generation'da değilse hiçbir DOM state değiştirmez.
- Destroy pending RAF'i iptal eder; tarayıcı iptal edilmiş callback'i yine de teslim ederse generation + ownership kontrolleri ikinci savunma katmanıdır.
- Destroy öncesi capture edilmiş MutationObserver, scroll veya click callback referansları teardown sonrasında scroll başlatamaz veya yeni RAF planlayamaz.
- `handleScroll`, `handleMutation`, `handleButtonClick`, `scrollToBottom` ve `scheduleMeasure` teardown sonrası doğrudan çağrılsa bile inert kalır.

## Style ownership

`#hafize-scroll-to-latest-style` host tarafından zaten sağlanıyorsa controller onu değiştirmez veya kaldırmaz. Style bu controller mount'u sırasında yaratıldıysa başarısız rollback ve normal destroy sırasında kaldırılır. Böylece host DOM durumu mount öncesi haline dönebilir ve clean remount aynı kurallarla yeniden başlayabilir.

## PWA sınırı

`/scroll-to-latest.js` statik shell asset'idir. Service worker cache sürümü client modülü değiştiğinde bump edilir. `/api/*` cevapları her zaman network-only kalır; sohbet/API cevapları shell cache'e alınmaz.

## Test / DoD

Regresyon testleri en az şunları kilitler:

- 96px pinned eşiği ve reduced-motion davranışı;
- kullanıcı yukarıdayken yeni yanıtın zorla kaydırmaması;
- duplicate document ownership'in reddedilmesi;
- host button exact restore;
- listener, observer ve RAF installation fault injection rollback'i;
- stale observer/scroll/click/RAF callback'lerinin destroy sonrası inertliği;
- PWA shell asset kaydı ve API network-only sınıflandırması;
- storage/network/credential veri sınırının aşılmaması.

## Geri alma

Bu controller, testler, doküman ve ilgili shell cache bump'ı tek PR olarak revert edilebilir. `app.js`, konuşma veri formatı, agent registry, model provider ve backend tool permission sözleşmeleri değişmez.
