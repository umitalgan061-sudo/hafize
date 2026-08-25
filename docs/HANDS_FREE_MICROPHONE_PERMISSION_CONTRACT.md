# Hands-free microphone permission boundary

Bu belge Hafize'nin opt-in hands-free / wake phrase özelliğinde tarayıcı mikrofon izninin çalışma zamanı güvenlik sınırını tanımlar.

## Amaç

Hands-free yalnız kullanıcının görünür ve açık onayıyla başlayan geçici bir mikrofon oturumudur. Kullanıcı tarayıcı veya işletim sistemi ayarından mikrofon iznini geri çektiğinde, aktif oturum SpeechRecognition servisinin ne zaman hata vereceğine bağlı kalmadan kapatılmalıdır.

Bu sınır yeni bir mikrofon yetkisi üretmez. Yalnız mevcut yetki azaldığında aktif dinlemeyi sonlandırır.

## Yetki kaynağı

- `navigator.permissions.query({ name: 'microphone' })` yalnız tarayıcı tarafından raporlanan izin durumunu gözlemlemek için kullanılır.
- İzin durumu model, prompt, ajan, connector payload'ı, local storage veya server cevabından alınmaz.
- `granted` yalnız gözlemlenen tarayıcı durumudur; Hafize'nin kendi hands-free kullanıcı onayının yerine geçmez.
- `prompt` ve `denied`, aktif bir hands-free oturumu için güvenilir mikrofon yetkisinin devam ettiği anlamına gelmez ve oturumu revoke eder.
- Bilinmeyen bir Permission API state'i `unknown` olarak ele alınır; bilinmeyen değer approval sayılmaz ve sahte bir browser state üretilmez.

## Disable-only davranış

İzin kaybı mevcut `hafize:hands-free-revoke` event kanalını kullanır. Bu kanal yalnız `enabled -> disabled` yönünde çalışır.

Revocation sırasında:

1. runtime `setEnabled(false)` canonical yoluna girer;
2. aktif recognizer abort edilir;
3. restart, handoff, cooldown ve session timer'ları temizlenir;
4. görünür hands-free state kapalıya döner;
5. yeniden dinleme otomatik başlamaz.

İzin daha sonra tekrar `granted` olsa bile runtime açılmaz. Kullanıcının görünür hands-free kontrolünden yeniden açık onay vermesi gerekir.

## Başlangıç ve yarışlar

Permission sorgusu asenkrondur. Guard kurulurken hands-free aktif ve sorgu sonucu `prompt` veya `denied` gelirse sonuç çözüldüğü anda oturum fail-closed revoke edilir.

Guard destroy edildikten sonra geç dönen Promise sonucu yeni listener bağlayamaz, state değiştiremez veya runtime'ı revoke edemez. PermissionStatus yenilenirse eski `change` listener'ı önce kaldırılır. Böylece eski browser status nesnesi artık yetki sahibi olmaz.

Arka plan/focus revocation daha önce oturumu kapattıysa daha sonra gelen permission-change sinyali ikinci bir revoke veya yeniden etkinleştirme üretmez.

## Permissions API olmayan tarayıcılar

Permissions API veya `microphone` descriptor desteği olmayan tarayıcılarda bu ek gözlem katmanı `unavailable` kalır. Bu durum hands-free'i otomatik olarak açmaz veya yeni bir izin varsaymaz.

Mevcut SpeechRecognition terminal hata sınırı korunur. `not-allowed`, `service-not-allowed`, `security` ve `audio-capture` gibi terminal hatalar runtime'ı kapatmaya devam eder. Böylece yeni katman desteklenmeyen tarayıcıda eski güvenlik davranışını zayıflatmaz.

## Kullanıcı bildirimi

Permission revocation görünür durumda gerçekleşirse kullanıcıya mikrofon iznini kontrol etmesi ve hands-free'i tekrar açıkça açması gerektiği söylenir. Uygulama arka plandaysa bildirim, kullanıcı görünür bağlama döndüğünde mevcut one-shot notice mekanizmasıyla gösterilebilir.

Bildirim:

- transcript içermez;
- permission token veya credential içermez;
- raw browser metadata içermez;
- storage veya network yazımı yapmaz.

## Gizlilik ve veri akışı

Permission guard yalnız izin state'i ve yerel lifecycle event'leri ile çalışır. Mikrofon sesi, transcript, sohbet içeriği, secret, API key, OAuth token veya approval token okumaz ve taşımaz.

Bu katman:

- network isteği yapmaz;
- local/session storage yazmaz;
- cookie yazmaz;
- server-side memory write yapmaz;
- dış mesaj/gönderme başlatmaz;
- cihaz bridge yetkisi açmaz.

## Agent ve provider sınırı

Bu davranış model sağlayıcısından bağımsızdır. NVIDIA NIM ana/default provider olarak kalır; local/Ollama seçimi mikrofon izninin anlamını değiştiremez.

Agent registry genişletilmez. Dört profilli seçici mimari korunur. Hiçbir ajan permission state'i veya hands-free approval üretemez.

Backend default-deny tool permission, external-write approval, trace/task ledger ve secret izolasyonu bu değişiklikten etkilenmez.

## DoD

Bu sınır tamamlanmış sayılmak için en az şu davranışları doğrulamalıdır:

- `granted -> denied` aktif runtime'ı kapatır;
- `granted -> prompt` aktif runtime'ı kapatır;
- permission restoration auto-enable yapmaz;
- initial denied/prompt async sonucu aktif oturumu kapatır;
- inactive runtime permission event'iyle açılmaz;
- destroy PermissionStatus listener'ını kaldırır;
- geç Promise sonucu destroy edilmiş guard'ı diriltmez;
- Permissions API yoksa SpeechRecognition terminal-error fallback'i çalışır;
- revocation synthetic consent click üretmez;
- secret/storage/network yüzeyi eklenmez.

## Geri alma

Bu davranış `public/hands-free-background-guard.js` içindeki permission watcher ve ona ait test/sözleşme dosyalarıyla sınırlıdır. Revert edildiğinde önceki background/focus revocation ve disable-only runtime kanalı bağımsız olarak çalışmaya devam eder.
