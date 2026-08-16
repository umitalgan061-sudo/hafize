# Local agent/tool provider boundary

## Amaç

Hafize'de `local:` model kimliği bir veri-akışı sınırıdır. Normal `/api/chat` istekleri provider-aware router ve local context-compaction yolunu kullanabilir; NVIDIA tabanlı agent/tool yürütme yolu ise yerel model seçildiğinde sessizce NVIDIA'ya düşmemelidir.

## Zorunlu davranış

- `local:` model, NVIDIA tabanlı agent/tool yürütmesinde fail-closed reddedilir.
- Red kodu `LOCAL_PROVIDER_TOOLS_UNSUPPORTED` olur.
- Red, NVIDIA completion çağrısından ve tool yürütmesinden önce gerçekleşir.
- Delegated/fork agent yürütmesi de aynı sınıra tabidir; specialist ajan parent'ın provider sınırını aşamaz.
- Base context compactor, local model için yalnız açık provider-aware `summarize` override verildiğinde çalışabilir.
- Provider-aware local compactor normal `/api/chat` akışında local summarizer kullanmaya devam eder; bu sınır local sohbet özelliğini kapatmaz.

## Neden UI kontrolü yeterli değil?

Model seçici arayüzü local model + tools kombinasyonunu engellese de backend endpoint'leri elle hazırlanmış isteklerle çağrılabilir. Güvenlik sözleşmesi istemci davranışına güvenemez. Bu nedenle sınır backend runtime katmanlarında tekrar uygulanır.

## Veri güvenliği

Bu sınırın temel amacı local konuşma/task içeriğinin yanlışlıkla NVIDIA completion yoluna taşınmasını önlemektir. Rejection sırasında prompt, task veya tool sonucu başka providera gönderilmez. Secret/credential değerleri ajan bağlamına alınmaz ve mevcut backend default-deny tool politikası değişmez.

## Tool policy

Provider seçimi ajan yetkisini genişletmez. `local:` model destekli tool runtime gelecekte eklenirse:

1. ayrı provider-aware tool execution tasarımı,
2. aynı backend default-deny permission enforcement,
3. external write/send/merge için açık kullanıcı onayı,
4. shared `trace_id` ve task ledger,
5. provider-specific cancellation ve regresyon testleri

zorunludur. NVIDIA yoluna otomatik fallback güvenli varsayım değildir.

## Regresyon kanıtı

- `scripts/test-model-provider-tool-boundary.mjs`
- `scripts/test-local-agent-provider-boundary-integration.mjs`
- mevcut `scripts/test-model-provider-context-compaction.mjs`

İntegration testi base/NVIDIA compactor'ın local modeli summary çağrısından önce reddettiğini, provider-aware local compactor'ın kısa local sohbeti bozmadan koruduğunu ve delegated agent'ın NVIDIA completion/tool çağrısı yapmadan fail-closed döndüğünü doğrular.
