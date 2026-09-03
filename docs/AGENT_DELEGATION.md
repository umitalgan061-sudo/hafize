# Agent Delegation Runtime

`/api/agent/run` ana Hafize ajanının registry tarafından izin verilen uzman ajanlara dar kapsamlı görevler devretmesini destekler.

## Tool sözleşmesi

NVIDIA'ya görünen function adı `agent_delegate` olur ve iki alan alır:

- `agentId`: `agents/registry.json` içindeki hedef uzman kimliği.
- `task`: uzmana verilen dar kapsamlı görev metni.

Backend bu function'ı registry'deki `agent.delegate` permission'ına bağlar. Modelin tool adını üretmesi tek başına yetki vermez.

## Backend sınırları

Delegasyon yürütmesi şu kontrolleri model çağrısından önce uygular:

- Kaynak ajan `agent.delegate` için allowlist edilmiş olmalıdır.
- Hedef ajan registry'de bulunmalı ve `kind: specialist` olmalıdır.
- Ajan kendisine delegasyon yapamaz.
- `policy.maxDelegationDepth` aşılırsa çağrı reddedilir.
- `policy.maxParallelAgents` aynı parent run içindeki delegation fan-out üst sınırı olarak uygulanır.
- Geçersiz/çok uzun görev metni NVIDIA'ya gönderilmez.

## Trace ve task ledger

Ana run ile uzman çağrısı aynı `trace_id` değerini kullanır. Ledger'da uzman için `agent.delegate` child task açılır; görev metni, model çıktısı, tool argümanları veya secret değerleri ledger'a yazılmaz. Başarı `completed`, hata sanitize edilmiş error code ile `failed` olarak kapanır.

## Yetki izolasyonu

Bu ilk delegasyon sürümünde uzman çağrısına parent ajanın tool listesi aktarılmaz ve uzman çağrısına herhangi bir NVIDIA tool tanımı verilmez. Böylece parent tool permission'larının alt ajana miras kalması mümkün değildir.

Sonraki genişletme, uzmanlara yalnızca kendi registry allowlist'lerinden türetilmiş tool setlerini ayrı bir execution context içinde açabilir; parent tool setini kopyalamak yasaktır.

## İptal ve zaman aşımı

`runDelegatedAgent` iki opsiyonel parametre alır:

- `signal`: dış `AbortSignal`. Server, istemci bağlantısını kapattığında kullandığı
  `controller.signal` değerini geçirir.
- `timeoutMs`: tur için duvar saati sınırı. Kabul aralığı 1.000–600.000 ms; aralık
  dışındaki veya tamsayı olmayan değerler `INVALID_DELEGATED_TIMEOUT` ile reddedilir.
  `AbortSignal` olmayan bir `signal` ise `INVALID_DELEGATED_SIGNAL` döndürür.

İki kaynak tek bir iç sinyalde birleştirilir ve iç içe delegasyonlara devredilir:
parent iptal edildiğinde alt ajan turları da iptal olur. Sinyal `complete(payload, signal)`
ikinci argümanı olarak model katmanına iletilir; hiçbiri verilmezse davranış değişmez.

İptal noktaları ve sonuçları:

| Durum | Sonuç |
| --- | --- |
| Tur başlamadan iptal | `DELEGATED_RUN_ABORTED`, model hiç çağrılmaz |
| Model çağrısı sırasında iptal | `DELEGATED_RUN_ABORTED`, ham `AbortError` sızmaz |
| Araç turunda iptal | `DELEGATED_RUN_ABORTED`, kalan araçlar başlatılmaz, ikinci model çağrısı yapılmaz |
| `timeoutMs` doldu | `DELEGATED_RUN_TIMEOUT` |
| İptal yokken upstream hatası | Hata yutulmaz, çağırana yükselir |

Ledger tarafında iptal edilen turda yarım araç kaydı bırakılmaz: bir araç yalnızca
başlatılacaksa `recordToolStart` çağrılır, başlatılmış her araç `recordToolFinish`
ile kapanır. Zamanlayıcı her koşulda `finally` içinde temizlenir.

Test: `scripts/test-delegated-run-cancellation.mjs`.
