# Hafize ajan handoff sözleşmesi

Bu sözleşme `msitarzewski/agency-agents` içindeki Orchestrator ve Workflow Architect yaklaşımlarından Hafize'ye uyarlanmıştır. Amaç, bir ajanın başka bir uzmana görev devrederken serbest metin bırakmak yerine doğrulanabilir bir iş paketi üretmesidir.

## Temel ilke

Delegasyon **yetki devri değildir**. Parent agent'ın yazdığı görev metni, target agent'a yeni tool veya permission kazandırmaz. Gerçek izin kararı yalnız backend default-deny tool policy tarafından verilir.

## Handoff alanları

Her delegasyonda zorunlu çekirdek:

- `agentId`: registry içindeki hedef uzman.
- `task`: tek ve dar kapsamlı görev.

Görev karmaşıksa aşağıdaki alanlar eklenir:

- `successCriteria`: işin başarılı sayılması için gözlenebilir koşullar.
- `constraints`: korunacak kapsam, güvenlik veya davranış sınırları.
- `evidenceRequired`: test, kaynak, dosya/konum, ölçüm veya başka doğrulama kanıtı.

## İyi handoff örneği

```json
{
  "agentId": "agency-code-reviewer",
  "task": "Bu PR'daki zamanlanmış görev değişikliğini doğruluk ve güvenlik açısından incele.",
  "successCriteria": [
    "Blocker bulgular dosya ve etkiyle belirtilmiş olsun",
    "Owner isolation ve retry davranışı değerlendirilmiş olsun"
  ],
  "constraints": [
    "Kod değiştirme",
    "Secret veya credential içeriği isteme"
  ],
  "evidenceRequired": [
    "İncelenen dosyaları belirt",
    "Varsa ilgili test veya eksik test yüzeyini belirt"
  ]
}
```

## Handoff kalite kapısı

Bir delegasyon şu koşullarda eksik kabul edilir:

1. Görev birden fazla bağımsız işi tek pakete sıkıştırıyorsa.
2. Hedef ajanın neden seçildiği anlaşılamıyorsa.
3. Sonucun başarılı sayılması için hiçbir gözlenebilir ölçüt yoksa ve görev karmaşıksa.
4. Riskli bir iddia için kanıt beklentisi tanımlanmamışsa.
5. Handoff metni yeni izin, secret erişimi veya policy bypass etmeye çalışıyorsa.

## Failure sözleşmesi

Delegasyon başarısız olduğunda parent agent bunu başarılı sonuç gibi sentezlemez. Sonuç en az şu sınıflardan birine ayrılır:

- `validation`: handoff alanları geçersiz veya eksik.
- `authorization`: hedef/tool backend policy tarafından izinli değil.
- `capacity`: depth/fan-out veya çalışma kapasitesi aşıldı.
- `execution`: uzman çalıştı ama görevi tamamlayamadı.
- `evidence`: cevap var fakat istenen doğrulama kanıtı yok.

Retry yalnız transient/capacity benzeri tekrar denenebilir durumlarda ve bounded policy içinde düşünülebilir. Permanent authorization veya validation hatası otomatik retry edilmez.

## Trace ve ledger

Parent ve target aynı `trace_id` zincirinde kalır. Delegasyon ayrı task ledger girdisi üretir ve parent-child ilişkisi korunur. Kullanıcıya gösterilen özet secret, ham tool argümanı veya özel credential taşımaz.

## Uygulama notu

Bu dosya runtime authorization'ın yerine geçmez. Executable `agent_delegate` sözleşmesi değiştirileceği zaman bu doküman test girdisi olarak kullanılmalı; eski `{agentId, task}` çağrıları geriye dönük uyumlu kalmalıdır.
