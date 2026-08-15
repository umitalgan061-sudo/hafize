# Voice input / hands-free handoff contract

Hafize'nin tarayıcı ses katmanında push-to-talk (`public/voice-input.js`) ve opt-in wake phrase (`public/hands-free.js`) aynı mikrofon kaynağını paylaşır. Bu belge iki özelliğin birbirini ezmeden nasıl çalışacağını ve hangi gizlilik sınırlarının korunacağını tanımlar.

## Tek mikrofon sahibi

Aynı anda iki `SpeechRecognition` oturumu aktif tutulmaz.

- Hands-free yalnız wake phrase beklerken mikrofon sahibidir.
- Kullanıcı mikrofon düğmesine bastığında push-to-talk oturumu mikrofon sahipliğini alır.
- Push-to-talk sahipliği tarayıcı `SpeechRecognition.start()` çağrısından **önce** ilan edilir. Böylece tarayıcının `onstart` callback'i gecikse bile wake recognition aynı mikrofon üzerinde yeniden başlayamaz.
- Hands-free açıkken `Hafize` wake phrase algılanırsa mevcut wake recognition durur ve push-to-talk düğmesine kontrollü handoff yapılır.
- Push-to-talk bittiğinde, hands-free hâlâ kullanıcı tarafından açık bırakılmışsa wake recognition kısa gecikmeyle yeniden başlar.
- Sekme gizliyken veya mesaj input'u backend yanıtı nedeniyle kilitliyken hands-free yeniden başlatılmaz.

Bu koordinasyon modelin veya agent prompt'unun kararı değildir; istemci runtime'ında deterministik olarak uygulanır.

## Yaşam döngüsü olayı

Push-to-talk aşağıdaki document-level olayı yayınlar:

`hafize:voice-input-state`

Event detail yalnız iki alan taşır:

```json
{
  "listening": true,
  "source": "voice-input"
}
```

`listening` yalnız boolean kabul edilir. Buradaki `true`, tarayıcı `onstart` sinyalini beklemekten ziyade push-to-talk'ın mikrofon sahipliğini claim ettiği andan itibaren geçerlidir; `start()` senkron olarak başarısız olursa aynı akış hemen `listening: false` yayınlar. Hands-free yalnız `source === "voice-input"` olan olayları dikkate alır; başka component veya rastgele DOM olayı mikrofon sahipliğini değiştiremez.

Olay yeni bir tool permission veya backend yetkisi değildir. Yalnız aynı sayfadaki ses UI modüllerinin durum senkronizasyonu için kullanılır.

## Wake phrase handoff

1. Kullanıcı eller-serbest modunu açıkça açar.
2. Görünür gösterge `Hafize` için dinlendiğini bildirir.
3. Wake phrase bulunduğunda hands-free recognition durur.
4. Mevcut `#micBtn` push-to-talk akışı tetiklenir.
5. Push-to-talk, browser recognition'ı başlatmadan önce `listening: true` yayınlar; hands-free bunu senkron görür, restart planını iptal eder ve varsa wake recognition'ı abort eder.
6. Browser recognition daha sonra `onstart` verse bile ikinci bir sahiplik geçişi oluşmaz.
7. Push-to-talk `listening: false` yayınladığında hands-free uygunsa wake dinlemeyi yeniden planlar.

Push-to-talk tarayıcıda desteklenmiyorsa veya `start()` çağrısı başarısız olursa handoff sonrası hands-free kalıcı biçimde sessiz kalmaz; `listening: false` sonrası fallback restart yolu tekrar wake dinlemeye döner.

## Kullanıcı kontrolü ve gizlilik

- Hands-free varsayılan olarak kullanıcı eylemi olmadan etkinleştirilmez.
- Mikrofon kullanımı UI'da görünür kalır.
- Wake phrase veya push-to-talk metni otomatik olarak gönderilmez; yalnız composer alanına yazılır.
- Speech Recognition tarayıcı/işletim sistemi sağlayıcısı tarafından işlenebilir; bu durum push-to-talk başlangıcında kullanıcıya görünür mesajla belirtilir.
- Sekme arka plana geçtiğinde aktif recognition iptal edilir.
- Bu özellik secret, credential veya agent tool permission üretmez.
- NVIDIA NIM model seçimi ve backend default-deny tool policy bu sözleşmeden bağımsızdır.

## Sesli yanıt ile etkileşim

`public/voice-output.js`, doğrulanmış `source: "voice-input"` ve `listening: true` lifecycle olayını doğrudan dinler. Push-to-talk mikrofonu `SpeechRecognition.start()` öncesinde claim ettiği anda devam eden TTS senkron olarak iptal edilir; böylece MutationObserver turunu bekleyen bir ses çakışma penceresi kalmaz. `#micBtn[aria-pressed="true"]` gözlemi geriye uyumluluk için ikinci savunma olarak korunur. Sesli yanıt tercihi ile hands-free tercihi birbirinden bağımsız kalır.

## Regresyon kanıtı

`scripts/test-voice-handoff-coordination.mjs` şu davranışları doğrular:

- manuel push-to-talk'ta sahiplik event'inin `SpeechRecognition.start()` çağrısından önce yayınlanması;
- manuel push-to-talk başladığında wake recognition'ın browser start çağrısından önce abort edilmesi;
- push-to-talk bittiğinde wake dinlemenin geri gelmesi;
- `Hafize` wake phrase sonrası pre-start sahiplik korunarak push-to-talk handoff'u;
- aktif push-to-talk sırasında ikinci wake recognition açılmaması;
- senkron `start()` hatasında sahipliğin bırakılması ve wake listener'ın geri gelmesi;
- tanınmayan lifecycle event'lerinin ignored kalması;
- görünmeyen sekmede recognition'ın durması ve restart edilmemesi;
- transcript'in composer'a eklenmesi fakat form submit edilmemesi.

`scripts/test-voice-output-barge-in.mjs` ayrıca güvenilir `listening: true` event'inin TTS'i MutationObserver callback'i olmadan anında kestiğini, yanlış source/false event'lerinin konuşmayı kesmediğini ve `destroy()` sonrasında listener'ın kaldırıldığını doğrular.

## Geri alma

Bu özellik geri alınacaksa `voice-input` state event'i, `hands-free` listener/restart koordinasyonu ve `voice-output` doğrudan barge-in listener'ı birlikte değerlendirilmelidir. Yalnız bir tarafın revert edilmesi tekrar çift recognition, wake-listener'ın tek handoff sonrası sessiz kalması veya TTS ile mikrofon arasında kısa bir çakışma penceresi riskini doğurur.