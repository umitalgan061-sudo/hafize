# Hafize local/Ollama provider güvenlik sınırı

Bu katman NVIDIA NIM ana sağlayıcısını değiştirmez. Amaç, kullanıcı açıkça etkinleştirirse yalnız aynı cihazdaki Ollama OpenAI-compatible API'sine yönlendirilebilecek bağımsız bir provider boundary hazırlamaktır.

## Opt-in modeli

- Local provider varsayılan olarak kapalıdır.
- Local model kimlikleri `local:` prefix'i taşır; NVIDIA model adları bundan etkilenmez.
- Bu PR production `server.mjs` routing'ini değiştirmez. Entegrasyon ayrıca testli bir turda yapılmalıdır.
- Local provider etkin değilken network çağrısı yapılmaz.

## Ağ sınırı

Provider yalnız `http://localhost`, `http://127.0.0.1` veya `http://[::1]` hedeflerini kabul eder. HTTPS cloud endpoint, LAN IP, public hostname, URL credential, query veya fragment kabul edilmez. Böylece bu boundary Ollama Cloud veya key gerektiren harici bir servis istemcisine dönüşmez.

Ollama'nın resmi API dokümantasyonu local API'nin varsayılan olarak `localhost:11434` üzerinde çalıştığını ve local erişimde authentication gerekmediğini belirtir. Hafize bu nedenle local adapter'a API key alanı eklemez.

## Tool güvenliği

Ollama tool calling desteklese bile tool yetkisi provider'a ait değildir. Provider yalnız backend'in zaten seçtiği `tools` payload'ını iletebilir. Hangi tool'un modele gösterileceği ve çağrının yürütülüp yürütülmeyeceği mevcut Hafize backend default-deny permission enforcement'inin sorumluluğunda kalır.

Bu PR agent registry veya `lib/tool-runtime.mjs` üzerinde yeni izin açmaz. Local model seçmek repo write, external send, merge, memory write veya başka bir capability kazandırmaz.

## Request ve response sınırı

- yalnız OpenAI-compatible chat alanlarının dar allowlist'i kabul edilir;
- `apiKey`, token veya bilinmeyen alanlar reddedilir;
- mesaj sayısı ve içerik boyutu sınırlıdır;
- provider hata gövdeleri ve local path ayrıntıları public error'a taşınmaz;
- cancellation `AbortSignal` üzerinden iletilir;
- model listesi public Hafize model kimliği olarak `local:<model>` biçimine dönüştürülür.

## Production entegrasyonunda korunacaklar

1. NVIDIA NIM varsayılan ve ana sağlayıcı olarak kalmalı.
2. Local provider ancak açık env/user opt-in ile açılmalı.
3. `local:` modeli yalnız local adapter'a gitmeli; diğer modeller NIM'e gitmeye devam etmeli.
4. Agent/tool permission kararı provider seçiminden önce/bağımsız uygulanmalı.
5. Health yalnız `localProviderConfigured:boolean` gibi capability bilgisi yayınlamalı; endpoint veya model ayrıntısı sızdırmamalı.
6. Streaming ve tool-call dönüşümleri için live regression testleri olmadan production route açılmamalı.

## Kaynak ve lisans yaklaşımı

Bu uygulama Jarvis kodunu kopyalamaz. Local-provider fikri Hafize mimarisine bağımsız uygulanmıştır. Wire contract için Ollama'nın resmi OpenAI compatibility ve tool-calling belgeleri referans alınmıştır.
