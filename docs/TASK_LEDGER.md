# Trace-scoped Task Ledger

Bu katman Hafize'nin hiyerarşik ajan mimarisinde ortak `trace_id` altında alt görevleri izlemek için küçük, bağımlılıksız bir ledger primitive'i sağlar.

## Kapsam

`lib/task-ledger.mjs` yalnızca bellekte yaşayan, tek trace'e bağlı ve bounded bir görev günlüğüdür. Henüz kalıcı cloud storage değildir ve kendi başına ajan delegasyonu çalıştırmaz. Amaç, bir sonraki delegasyon katmanının görev oluşturma/güncelleme sözleşmesini önce küçük ve test edilebilir biçimde sabitlemektir.

Her kayıt şu güvenli metadata alanlarını taşır:

- `taskId`
- `traceId`
- `agentId`
- `action`
- `status`
- opsiyonel `detail`
- opsiyonel `parentTaskId`
- oluşturma/güncelleme zamanları

İzin verilen durumlar: `planned`, `running`, `completed`, `failed`, `blocked`.

## Güvenlik ve sınırlar

- Ledger bir `traceId` olmadan oluşturulamaz.
- Varsayılan kapasite 64 kayıttır; maksimum 256'ya sınırlandırılır.
- Serbest metin alanlarının boyutu doğrulanır.
- Snapshot/read sonuçları kopya döndürür; dış kod iç durumu doğrudan mutate edemez.
- Secret/token/credential saklamak için bir alan tanımlanmaz; bu primitive yalnızca operasyonel görev metadata'sı içindir.
- Tool permission enforcement bu katmanın dışında, mevcut backend `default-deny` policy katmanında kalır.

## Neden şimdi?

`agents/registry.json` ve Agency Agents entegrasyon kararı ortak `trace_id` + task ledger yaklaşımını mimari gereksinim olarak tanımlıyor. NVIDIA tool-calling ve GitHub read-only araçları hazır olduğuna göre, gerçek `agent.delegate` runtime'ından önce alt görev yaşam döngüsünün veri sözleşmesini netleştirmek gerekir.

## Sonraki bağlantı

Bir sonraki küçük adımda `/api/agent/run` veya internal delegation runner her trace için bir ledger oluşturabilir; ana görev, uzman delegasyonu ve tool yürütmeleri aynı trace altında task kayıtlarına bağlanabilir. Cloud scheduler geldiğinde aynı sözleşmenin kalıcı store adaptörü eklenebilir.
