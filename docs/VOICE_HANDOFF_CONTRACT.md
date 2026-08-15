# Voice input / hands-free handoff contract

Hafize'nin tarayıcı ses katmanında push-to-talk (`public/voice-input.js`) ve opt-in wake phrase (`public/hands-free.js`) aynı mikrofon kaynağını paylaşır. Bu belge iki özelliğin birbirini ezmeden nasıl çalışacağını ve hangi gizlilik sınırlarının korunacağını tanımlar.

## Tek mikrofon sahibi

Aynı anda iki `SpeechRecognition` oturumu aktif tutulmaz.

- Hands-free yalnız wake phrase beklerken mikrofon sahibidir.
- Kullanıcı mikrofon düğmesine bastığında push-to-talk oturumu mikrofon sahipliğini alır.
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

`listening` yalnız boolean kabul edilir. Hands-free yalnız `source === "voice-input"` olan olayları dikkate alır; başka component veya rastgele DOM olayı mikrofon sahipliğini değiştiremez.

Olay yeni bir tool permission veya backend yetkisi değildir. Yalnız aynı sayfadaki ses UI modüllerinin durum senkronizasyonu için kullanılır.

## Wake phrase handoff

1. Kullanıcı eller-serbest modunu açıkça açar.
2. Görünür gösterge `Hafize` için dinlendiğini bildirir.
3. Wake phrase bulunduğunda hands-free recognition durur.
4. Mevcut `#micBtn` push-to-talk akışı tetiklenir.
5. Push-to-talk `listening: true` yayınladığında hands-free restart planını iptal eder.
6. Push-to-talk `listening: false` yayınladığında hands-free uygunsa wake dinlemeyi yeniden planlar.

Push-to-talk tarayıcıda desteklenmiyorsa handoff sonrası hands-free kalıcı biçimde sessiz kalmaz; fallback restart yolu tekrar wake dinlemeye döner.

## Kullanıcı kontrolü ve gizlilik

- Hands-free varsayılan olarak kullanıcı eylemi olmadan etkinleştirilmez.
- Mikrofon kullanımı UI'da görünür kalır.
- Wake phrase veya push-to-talk metni otomatik olarak gönderilmez; yalnız composer alanına yazılır.
- Speech Recognition tarayıcı/işletim sistemi sağlayıcısı tarafından işlenebilir; bu durum push-to-talk başlangıcında kullanıcıya görünür mesajla belirtilir.
- Sekme arka plana geçtiğinde aktif recognition iptal edilir.
- Bu özellik secret, credential veya agent tool permission üretmez.
- NVIDIA NIM model seçimi ve backend default-deny tool policy bu sözleşmeden bağımsızdır.

## Sesli yanıt ile etkileşim

`public/voice-output.js` mikrofon aktif olduğunda konuşmayı keser. Böylece kullanıcı barge-in yaptığında Hafize'nin TTS çıktısı mikrofon tanımasını bastırmaz. Sesli yanıt tercihi ile hands-free tercihi birbirinden bağımsız kalır.

## Regresyon kanıtı

`scripts/test-voice-handoff-coordination.mjs` şu davranışları doğrular:

- manuel push-to-talk başladığında wake recognition'ın abort edilmesi;
- push-to-talk bittiğinde wake dinlemenin geri gelmesi;
- `Hafize` wake phrase sonrası push-to-talk handoff'u;
- aktif push-to-talk sırasında ikinci wake recognition açılmaması;
- tanınmayan lifecycle event'lerinin ignored kalması;
- görünmeyen sekmede recognition'ın durması ve restart edilmemesi;
- transcript'in composer'a eklenmesi fakat form submit edilmemesi.

## Geri alma

Bu özellik geri alınacaksa `voice-input` state event'i ile `hands-free` listener/restart koordinasyonu birlikte geri alınmalıdır. Yalnız bir tarafın revert edilmesi tekrar çift recognition veya wake-listener'ın tek handoff sonrası sessiz kalması riskini doğurur.
