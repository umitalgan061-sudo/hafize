# Hands-free microphone device-loss contract

Bu sözleşme, Hafize'nin eller serbest dinleme oturumu açıkken fiziksel veya işletim sistemi düzeyinde kullanılabilir mikrofon kalmaması durumunda uygulanacak fail-closed davranışı tanımlar.

## Amaç

Tarayıcı mikrofon izni `granted` olarak kalırken USB/Bluetooth mikrofonun çıkarılması, sanal giriş aygıtının kaldırılması veya işletim sisteminin giriş aygıtını kaybetmesi mümkündür. SpeechRecognition bu durumu daha sonra `audio-capture` veya başka bir terminal hata ile bildirebilir; ancak bu gecikmeye güvenmek aktif dinleme durumunu gereksiz yere belirsiz bırakır.

Bu katman mevcut permission watcher'ın yerine geçmez. Permission watcher yetkinin geri çekilmesini, device watcher ise kullanılabilir `audioinput` kalmamasını gözler. Her ikisi de aynı disable-only `hafize:hands-free-revoke` kanalını kullanır.

## Güvenlik sınırı

- Device watcher yalnız `navigator.mediaDevices.enumerateDevices()` kullanır.
- `getUserMedia` çağrılmaz; yeni mikrofon izni istenmez ve ses akışı açılmaz.
- Sonuçlardan yalnızca `kind === "audioinput"` bilgisi değerlendirilir.
- Cihaz adı, `deviceId`, `groupId` veya label okunmaz, saklanmaz, loglanmaz ve network'e gönderilmez.
- `devicechange` yalnız eller serbest gerçekten aktifken yeni inventory kontrolü başlatabilir.
- Eller serbest kapalıyken install veya devicechange olayı cihaz envanteri probe etmez.
- Enumeration başarısızlığı “mikrofon yok” şeklinde yorumlanmaz. Durum `unavailable` olur ve mevcut SpeechRecognition/permission güvenlik yolları devam eder.
- Kullanılabilir mikrofon kalmadığı doğrulanırsa oturum `microphone-device-unavailable` nedeni ile disable-only revoke kanalından kapatılır.
- Mikrofon daha sonra geri gelse bile otomatik yeniden etkinleştirme yoktur. Kullanıcının görünür Eller serbest kontrolünden yeniden onay vermesi gerekir.

## Yarış ve lifecycle kuralları

`enumerateDevices()` asenkron olduğu için her kontrol generation-bound çalışır. Daha eski Promise sonucu daha yeni cihaz gözlemini değiştiremez. Guard destroy edildikten sonra geç dönen sonuç revocation, UI mutation veya listener kurulumu yapamaz.

Destroy sırasında `devicechange` listener'ı kaldırılır ve generation ilerletilir. Kullanıcının açıkça eller serbesti kapatması, bekleyen “mikrofon yok” sonucundan daha yüksek önceliklidir: sonuç gözlem durumunu güncelleyebilse bile kapalı oturum üzerinde yeni bir yan etki üretemez.

## UI davranışı

Revocation görünür toast yoluyla kullanıcıya açıklanır. Metin; uygulamanın arka plana geçmesi, mikrofon izninin kaldırılması veya kullanılabilir mikrofon kalmaması senaryolarını kapsar. Device watcher kendi modalını, sentetik click'i veya gizli yeniden başlatma mekanizmasını oluşturmaz.

## Mimari uyum

Bu değişiklik yalnız tarayıcı/PWA hands-free gizlilik sınırını daraltır. NVIDIA NIM ana/default model sağlayıcısı olarak kalır. Local/Ollama provider routing, dört profilli agent registry, shared trace/task ledger, connector OAuth akışları ve backend default-deny tool authorization değiştirilmez.

Model veya ajan device watcher üzerinden mikrofon yetkisi kazanamaz. Bu gözlem katmanı tool permission sözleşmesinden bağımsızdır; dış yazma/gönderme/merge işlemlerinde açık kullanıcı approval gereksinimi aynen korunur.

## Kabul kriterleri

1. Aktif oturum + en az bir `audioinput` => revocation yok.
2. Aktif oturum + sıfır `audioinput` => disable-only revocation.
3. Aktif oturum sırasında `devicechange` sonrası son mikrofonun kaybolması => revocation.
4. Eller serbest kapalıyken install/devicechange => enumeration yok, revocation yok.
5. Enumeration exception => sahte denial/revocation yok.
6. Stale Promise sonucu daha yeni sonucu ezemez.
7. Destroy sonrası geç sonuç yan etki üretemez.
8. Device label/ID/group bilgisi source, controller state, storage, log veya network yüzeyine çıkmaz.
9. Mikrofon geri geldiğinde auto-resume olmaz.
10. Mevcut permission watcher, background/focus revoke ve SpeechRecognition terminal-error fallback davranışları korunur.

## Geri alma

Bu değişiklik mevcut `public/hands-free-background-guard.js` içindeki device watcher bölümü ile ona ait test/sözleşme dosyalarından oluşur. Permission watcher ve background/focus revocation katmanları bağımsız kalır; device watcher tek başına revert edilebilir.