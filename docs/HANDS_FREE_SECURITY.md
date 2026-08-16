# Hands-free mikrofon güvenlik sözleşmesi

Hafize'nin hands-free modu tarayıcının SpeechRecognition API'sini yalnız görünür ve açık kullanıcı opt-in'i ile kullanır.

## Varsayılan durum

- Hands-free her yeni sayfa oturumunda kapalı başlar.
- Etkinlik tercihi `localStorage`, `sessionStorage`, cookie veya backend belleğine yazılmaz.
- Sayfa yüklenmesi, PWA restore veya Electron açılışı mikrofon dinlemesini kendiliğinden başlatmaz.
- Kullanıcı her oturumda `Eller serbest` düğmesine açıkça basmalıdır.

## Görünür mikrofon durumu

Hands-free açıkken UI şu durumlardan birini görünür biçimde gösterir:

- `“Hafize” için dinliyor` — wake recognizer aktif.
- `Sesli giriş hazırlanıyor` — wake phrase algılandı, normal sesli giriş handoff'u bekleniyor.
- `Sesli giriş etkin` — normal voice-input recognizer mikrofonu kullanıyor.
- `Eller serbest beklemede` — mikrofon geçici olarak durdurulmuş durumda.

Sekme gizlenirse wake recognizer abort edilir. Sekme yeniden görünür olduğunda yalnız mod aynı sayfa oturumunda hâlâ açık ise yeniden başlatılabilir.

## Wake → voice-input handoff

Wake recognizer ve normal sesli giriş recognizer'ı aynı anda çalışmamalıdır.

1. Exact normalize edilmiş `Hafize` wake kelimesi algılanır.
2. Wake recognizer durdurulur.
3. UI handoff bekleme durumuna geçer.
4. Normal sesli giriş tetiklenir.
5. `hafize:voice-input-state` olayı `listening:true` doğrularsa wake restart engellenir.
6. Normal sesli giriş `listening:false` bildirdiğinde wake recognizer yeniden planlanabilir.

Normal sesli giriş başlamazsa handoff sonsuza açık kalmaz. Bounded fallback sonrasında wake dinlemesi güvenli biçimde geri açılır.

## Fail-closed durumlar

- Mikrofon izni reddedilirse hands-free kapanır.
- Input disabled ise wake recognizer durur.
- Sayfa gizlenirse pending handoff ve wake recognition temizlenir.
- Controller destroy edildiğinde timer, observer ve mikrofon lifecycle'ı kapatılır.
- SpeechRecognition desteklenmiyorsa toggle disabled kalır.

## Değişmeyen sınırlar

- Wake phrase mesajı otomatik göndermez; yalnız normal sesli giriş akışına geçirir.
- Speech transcript harici sisteme doğrudan gönderme yetkisi üretmez.
- Hands-free agent/tool permission sözleşmesini değiştirmez.
- Secret, credential veya API key istemci koduna eklenmez.
- Jarvis üçüncü taraf uygulama kodu kopyalanmaz; bu sözleşme Hafize için bağımsız uygulanır.
