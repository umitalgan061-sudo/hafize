# Hafize ses etkileşimi güvenlik sözleşmesi

Bu belge `voice-input`, `voice-output` ve `hands-free` tarayıcı katmanlarının birbirleriyle nasıl koordine olduğunu tanımlar. Amaç, mikrofon/TTS yaşam döngüsünü görünür ve kullanıcı kontrollü tutarken Hafize'nin kendi sesini tekrar uyandırma ifadesi olarak algılamasını engellemektir.

## Temel varsayım

Sesli yanıt ile wake phrase dinlemesi aynı cihazın hoparlör ve mikrofonunu kullanabilir. Echo cancellation tarayıcı veya işletim sistemi tarafından sağlansa bile güvenlik sınırı olarak kabul edilmez. Hafize uygulama seviyesinde, kendi TTS çıktısı konuşurken wake recognizer'ı kapalı tutar.

## Durum olayları

Tarayıcı içindeki voice modülleri dar, isimlendirilmiş DOM olayları kullanır:

- `hafize:voice-input-state`: normal sesli giriş recognizer'ının `listening` durumunu bildirir.
- `hafize:voice-output-state`: TTS katmanının `idle`, `thinking` veya `speaking` durumunu bildirir.

`voice-output-state` olayı yalnız durum bilgisidir. Metin, credential, owner ID, model prompt'u veya başka hassas içerik taşımaz. Minimum detail sözleşmesi:

- `source: "voice-output"`
- `state: "idle" | "thinking" | "speaking"`
- `speaking: boolean`
- `thinking: boolean`
- `enabled: boolean`
- `supported: boolean`

Hands-free yalnız `source === "voice-output"` ve boolean `speaking` alanını kabul eder. Beklenmeyen veya eksik event detail yetki vermez.

## Echo / self-wake engeli

`voice-output` TTS konuşmaya geçtiğinde:

1. `speaking:true` olayı yayınlanır.
2. Hands-free pending wake restart timer'ını temizler.
3. Aktif wake `SpeechRecognition` instance'ı abort edilir.
4. TTS bitene kadar yeni wake recognizer oluşturulmaz.
5. `speaking:false` sonrasında wake dinlemesi doğrudan değil, mevcut bounded restart gecikmesiyle geri gelir.

Bu davranış tarayıcının acoustic echo cancellation özelliğine güvenmez. TTS açıkken bir recognizer callback'i gecikmeli gelse bile `onresult` yolu `voiceOutputSpeaking` kontrolüyle wake handoff üretmez.

## TTS generation izolasyonu

Web Speech Synthesis API'de `speechSynthesis.cancel()` çağrısından sonra eski `SpeechSynthesisUtterance` callback'lerinin gecikmeli gelmesi mümkündür. Bu nedenle her yeni konuşma/cancel işlemi monoton bir in-memory generation değeriyle ayrılır.

- Eski generation'a ait `onend` yeni kuyruğu ilerletemez.
- Eski generation'a ait `onerror` yeni konuşmayı kapatamaz.
- Yalnız aktif generation ve exact aktif utterance callback'i queue state'ini değiştirebilir.
- Generation yalnız sayfa belleğindedir; storage'a yazılmaz ve kullanıcı verisi içermez.

Bu sınır yeni kullanıcı mesajı, mikrofon barge-in, sekme gizlenmesi veya sesli yanıtın kapatılması sırasında eski callback yarışlarını güvenli hale getirir.

## Kullanıcı kontrolü

- Sesli yanıt desteklense bile varsayılan açık değildir; mevcut explicit toggle tercihi gerekir.
- Hands-free her yeni sayfa oturumunda yeniden açık opt-in ister; mikrofon opt-in'i kalıcı storage'a yazılmaz.
- Wake phrase tek başına mesaj göndermez; yalnız normal voice-input akışına geçiş başlatır.
- Normal voice-input başladığında TTS iptal edilir.
- Yeni kullanıcı submit'i aktif TTS'yi iptal eder.
- Sekme gizlenince aktif TTS ve wake recognizer durdurulur.

## Yetki sınırı

Bu browser event'leri agent/tool permission üretmez. Model sağlayıcısı, ajan registry'si ve connector izinlerinden bağımsızdır. `external.write`, `external.send`, `repo.merge`, secret okuma veya işletim sistemi komutu gibi yetkiler ses durumundan türetilemez.

## Bilerek yapılmayanlar

- Hoparlör sesini mikrofonla ayırt etmek için kırılgan ses fingerprinting yoktur.
- `shell=True`, child process veya geniş terminal yürütme yoktur.
- Mikrofon kaydı otomatik olarak belleğe veya sohbet geçmişine yazılmaz.
- TTS metni `voice-output-state` event payload'ına eklenmez.
- Wake recognizer TTS sırasında yalnız CSS/UI sinyaline bakılarak açık bırakılmaz.

## Regresyon kanıtı

Canonical test suite şu davranışları kilitler:

- TTS state event'lerinin yalnız durum metadata'sı taşıması,
- stale utterance callback'lerinin yeni generation'ı değiştirememesi,
- TTS başlarken wake recognizer'ın abort edilmesi,
- TTS boyunca restart timer oluşturulmaması,
- TTS bitince bounded wake restart,
- failed handoff ile TTS çakıştığında wake'in kapalı kalması,
- source dosyalarında terminal/credential ve kalıcı hands-free opt-in desenlerinin geri gelmemesi.
