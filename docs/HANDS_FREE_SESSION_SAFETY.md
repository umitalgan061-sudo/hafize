# Eller serbest oturum güvenliği

Hafize'nin wake phrase / hands-free modu sürekli arka plan mikrofonu değildir. Kullanıcı görünür `Eller serbest` düğmesiyle her oturumda açıkça etkinleştirir; durum göstergesi dinleme, sesli giriş, Hafize konuşması ve yankı koruması evrelerini görünür tutar.

## Oturum sınırı

- Eller serbest dinleme tek açılışta en fazla **30 dakika** etkin kalır.
- Süre dolduğunda wake listener fail-closed kapanır ve aktif SpeechRecognition oturumu abort edilir.
- Yeniden dinleme için kullanıcının özelliği tekrar açması gerekir.
- Bu tercih localStorage, cookie, backend veya kişisel memory katmanına yazılmaz.
- Sekmenin gizlenmesi mikrofon dinlemesini durdurur; görünür olduğunda yalnız oturum hâlâ etkinse yeniden başlar.

## TTS yankı koruması

Hafize konuşurken wake listener kapalıdır. TTS `speaking=false` olduktan sonra listener hemen açılmaz; **1800 ms** yankı cooldown'u uygulanır. Bu sırada görünür durum `Yankı koruması etkin` olur. Amaç hoparlörden kalan `Hafize` kelimesinin yeni bir voice-input handoff'unu yanlışlıkla başlatmasını azaltmaktır.

Cooldown; hands-free kapatılırsa, voice input devralırsa, sekme gizlenirse veya controller destroy edilirse iptal edilir. Cooldown tamamlandıktan sonra normal bounded restart yolu kullanılır.

## Veri ve yetki sınırı

- Wake transcript'i sohbet geçmişine, memory katmanına veya backend'e otomatik yazılmaz.
- Wake phrase yalnız voice-input düğmesine handoff başlatır; mesaj otomatik gönderilmez.
- Network, connector, tool permission veya external write/send/merge yetkisi açılmaz.
- SpeechRecognition tarayıcı sağlayıcısı tarafından işlenebilir; kullanıcı bunu özelliği açarken görünür biçimde görür.
- Backend default-deny agent/tool politikası ve secret isolation değişmez.

## Regresyon sözleşmesi

`scripts/test-hands-free-session-safety.mjs` oturum expiry, TTS cooldown, visibility lifecycle, timer cleanup ve wake phrase sınırlarını doğrular. `scripts/test-hands-free-session-safety-integration.mjs` shell cache sürümünü ve network/storage/clipboard gibi yasak side-effect API'lerinin eklenmediğini kontrol eder.
