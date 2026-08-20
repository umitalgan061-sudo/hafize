# Voice output barge-in güvenlik sınırı

Hafize sesli yanıtı kullanıcı tarafından açılmış olsa bile aktif sesli giriş sırasında cihaz TTS çıktısı üretmemelidir. Bu sınır mikrofon iznini genişletmez; yalnız mevcut `voice-input` lifecycle bilgisini ses çıkışının fail-closed davranışına bağlar.

## Kaynak durum

`public/voice-input.js`, dinleme değişikliklerini `hafize:voice-input-state` olayıyla `{ source: "voice-input", listening: boolean }` olarak yayınlar ve `#micBtn` üzerindeki `aria-pressed` değerini aynı lifecycle içinde günceller. `public/voice-output.js` her iki sinyali de izler: custom event birincil hızlı yol, `aria-pressed` MutationObserver ise event kaçırılırsa durumun tekrar senkronize edilmesini sağlayan yerel fallback'tir.

Yabancı source, boolean olmayan `listening` veya malformed event payload mikrofon korumasını değiştiremez.

## Barge-in kuralları

Mikrofon dinlemeye geçtiğinde devam eden Speech Synthesis kuyruğu iptal edilir. Aktif dinleme boyunca otomatik response playback, doğrudan `speak()` ve "Tekrar oku" işlemi TTS başlatamaz. Kuyruktaki eski utterance callback'leri generation kontrolü nedeniyle yeni chunk başlatamaz.

Bir assistant stream'i mikrofon hâlâ dinlerken tamamlanırsa yanıt otomatik okunmaz. Mikrofon daha sonra kapandığında atlanan yanıt kendiliğinden gecikmeli olarak oynatılmaz; kullanıcı isterse "Tekrar oku" ile açıkça başlatır. Bu tercih, beklenmedik cihaz sesini ve mikrofonun Hafize'nin kendi TTS çıktısını yeniden transkribe etme riskini azaltır.

## Başlangıç ve teardown

Voice output kurulurken mikrofonun mevcut `aria-pressed="true"` durumu fail-closed olarak dinleme kabul edilir. Controller destroy edildiğinde event ve MutationObserver bağları kaldırılır; stale voice-input olayları artık output state'ini değiştiremez. Temiz remount mevcut installation ownership sözleşmesiyle mümkündür.

## Değişmeyen sınırlar

- Sesli yanıt opt-in olmaya devam eder ve yerel `SpeechSynthesis` kullanır.
- Mikrofon izni veya SpeechRecognition lifecycle'ı bu katman tarafından başlatılmaz.
- Hands-free consent sözleşmesi ve görünür mikrofon göstergesi değiştirilmez.
- NVIDIA NIM/model routing, tool permissions, secrets ve dış yazma onayları bu özellikten bağımsızdır.

## Regresyon kanıtı

`scripts/test-voice-output-barge-in-lifecycle.mjs` başlangıçta açık mikrofonu, custom event + ARIA senkronizasyonunu, stream-finish yarışını, manuel replay engelini, gecikmiş autoplay yapılmamasını, queued utterance cancellation'ını ve destroy/remount davranışını kapsar.
