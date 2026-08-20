# Hands-free consent boundary

Hafize'nin wake phrase / hands-free modu sürekli mikrofon erişimi açısından yüksek mahremiyetli bir istemci özelliğidir. Bu belge, özelliğin açık kullanıcı onayını hangi sınırlarla uyguladığını tanımlar.

## Amaç

Hands-free modu yalnız kullanıcının doğrudan ve görünür etkileşimiyle açılabilir. Sayfa içindeki başka bir script, sentetik DOM olayı veya gecikmiş consent paneli kullanıcının yerine mikrofon dinlemesini etkinleştirememelidir.

Bu sınır backend tool permission sisteminin yerine geçmez. Hands-free yalnız istemci tarafındaki mikrofon aktivasyon sözleşmesini korur; model sağlayıcısı, connector veya dış yazma yetkisi vermez.

## Açık onay akışı

1. Kullanıcı görünür `#handsFreeToggle` kontrolüne gerçek bir kullanıcı jestiyle basar.
2. Capture-phase consent guard normal toggle davranışını durdurur ve yalnız `event.isTrusted === true` ise inceleme panelini açar.
3. Panel, wake phrase dinlemesinin bu oturum için olduğunu, dinlemenin görünür kalacağını, 30 dakika sonra kapanacağını ve konuşmanın otomatik gönderilmeyeceğini açıklar.
4. Mikrofon aktivasyonu için ikinci bir gerçek kullanıcı jesti gerekir: `Onayla ve dinlemeyi aç` düğmesinin trusted click olayı.
5. Başarılı ikinci onaydan sonra consent guard yalnız tek bir dahili sentetik toggle click'ine geçici bypass verir.
6. Bypass synchronous `try/finally` sınırında tüketilir; daha sonraki sentetik click olayları bu izni yeniden kullanamaz.

## Sentetik olay politikası

Programatik `element.click()`, test dışı script tarafından üretilen `dispatchEvent()` ve `isTrusted !== true` olayları permission-increasing adımlarda kabul edilmez.

Sentetik toggle olayı:
- varsayılan toggle davranışı consent guard tarafından durdurulur;
- consent panelini açmaz;
- timer başlatmaz;
- mikrofon etkinleştirme akışını ilerletmez.

Sentetik confirm olayı:
- pending consent'i grant etmez;
- dahili toggle click'i üretmez;
- mevcut pending review'u kullanıcı iptal edene veya süre dolana kadar değiştirmez.

Permission-reducing işlemler aynı kurala tabi değildir. Örneğin `Vazgeç`, Escape, sekmenin gizlenmesi ve controller teardown her zaman pending consent'i kapatabilir. Bir güvenlik kontrolü izin azaltmak için trusted activation istememelidir.

## Bounded consent lease

Consent review yalnız `setTimeout` callback'ine güvenmez. Tarayıcılar arka planda timer'ları geciktirebildiği için review açılırken ayrıca absolute `expiresAt` hesaplanır.

- Consent süresi: 15 saniye.
- Timer normal UX kapanışını sağlar.
- Confirm sırasında canlı zaman yeniden okunur.
- `now >= expiresAt` ise consent expired kabul edilir ve mikrofon toggle'ına geçilmez.
- Böylece gecikmiş/throttled timer eski bir consent'i yeniden geçerli hale getiremez.

`setTimeout` veya `clearTimeout` yoksa installation `timer-unavailable` ile fail-closed olur. Timer kurulumu exception üretirse veya geçerli bir timer kimliği döndürmezse review pending duruma geçmez.

## Görünürlük ve güvenli bağlam

Consent review şu koşullarda başlayamaz:
- belge gizliyse;
- hands-free toggle disabled ise;
- secure context açıkça false ise;
- hands-free zaten enabled görünüyorsa.

Pending consent sırasında belge gizlenirse review iptal edilir ve timer temizlenir. Yeniden görünür olduğunda eski consent otomatik devam etmez; kullanıcı yeni bir açık onay akışı başlatmalıdır.

## Installation ownership

Aynı hands-free toggle üzerinde tek consent controller bulunabilir. Duplicate installation hata verir. Önceden var olan review id çakışması veya panel mount hatası permission yüzeyini açmak yerine toggle'ı blocked duruma geçirir.

Controller kurulurken host'a ait şu durumlar snapshot edilir:
- `disabled`;
- `title`;
- `data-consent-pending`;
- `data-consent-blocked`;
- `aria-describedby`.

Destroy sırasında Hafize yalnız kendi panelini ve listener'larını kaldırır; host tarafından daha önce sağlanan değerleri exact restore eder. Böylece consent katmanı başka bir UI sahibinin erişilebilirlik veya disabled durumunu kalıcı biçimde ezmez.

## Bypass sınırı

Trusted confirm sonrasında kullanılan bypass genel bir "trusted" işareti değildir. Yalnız consent controller'ın kendi synchronous `toggle.click()` çağrısını capture guard'dan geçirmek için kullanılır.

- Persist edilmez.
- Storage'a yazılmaz.
- Timer üzerinden taşınmaz.
- Başka event veya callback'e miras kalmaz.
- `finally` ile kesin olarak sıfırlanır.

Bu nedenle uygulamadaki başka bir script daha sonraki sentetik toggle click'iyle geçmiş kullanıcı onayını yeniden oynatamaz.

## Hands-free session sınırı

Bu belge consent review'un açılma sınırını tanımlar. Hands-free runtime ayrıca kendi görünür mikrofon göstergesi, dinleme durumu, sekme görünürlüğü ve maksimum session süresi kurallarını korur. Consent grant, session süresini sonsuz yapmaz ve kullanıcı adına mesaj gönderme yetkisi vermez.

Wake phrase algılanması yalnız sesli giriş UI'sını tetikleyebilir. Dış connector yazımı, Gmail gönderimi, GitHub merge veya başka yan etkiler Hafize'nin ayrı backend default-deny / explicit approval politikalarına tabidir.

## Test sözleşmesi

Regresyon testleri en az şu davranışları sabitler:
- synthetic toggle review açamaz;
- synthetic confirm grant üretemez;
- iki gerçek kullanıcı jesti normal akışı tamamlar;
- bypass yalnız bir dahili toggle click'i için geçerlidir;
- absolute deadline gecikmiş timer'dan bağımsız uygulanır;
- timer yokluğu/kurulum hatası fail-closed olur;
- hidden/insecure/disabled/already-enabled durumları review başlatmaz;
- Escape, cancel ve visibility change pending consent'i azaltır;
- duplicate installation ve review collision fail-closed kalır;
- destroy host attribute'larını ve listener ownership'ini geri yükler.

## Değişmeyen güvenlik ilkeleri

- Mikrofon onayı model sağlayıcısından bağımsızdır.
- NVIDIA NIM ana sağlayıcı olmaya devam eder; local provider seçimi bu consent'i atlatamaz.
- Hands-free özelliği tool permission vermez.
- Dış yazma/gönderme/merge işlemleri ayrıca açık uygulama onayı gerektirir.
- Secret veya credential değerleri hands-free bağlamına girmez.
- Kalıcı memory write bu özelliğin yan etkisi değildir.
