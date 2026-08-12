# Hafize — NVIDIA Tool Calling Güvenlik Katmanı

Bu geliştirme Hafize'de ilk gerçek NVIDIA NIM tool-calling döngüsünü açar; ancak yalnızca salt-okunur ve yerel bir araçla başlar.

## İlk araç

`runtime_status` yalnızca Hafize backend'inin çalışma durumunu döndürür:

- mevcut `traceId`
- aktif ajan kimliği ve adı
- NVIDIA bağlantısının yapılandırılmış olup olmadığı (`true/false`)
- public ajan kimlik/ad listesi

Secret, token, API anahtarı veya credential değeri döndürmez.

## Yetki zinciri

NVIDIA'ya her registry aracı otomatik olarak verilmez. Akış:

1. `agents/registry.json` ajanı çözümlenir.
2. Tool catalog içindeki aracın dahili permission adı bulunur.
3. `authorizeAgentTool()` default-deny policy uygular.
4. Yalnızca izinli araç NVIDIA `tools` listesine girer.
5. Model bir tool call döndürürse aynı policy yürütmeden hemen önce tekrar kontrol edilir.
6. Tool sonucu `role: tool` mesajıyla modele geri verilir.
7. İkinci model çağrısı `tool_choice: none` ile kapatılır; bu ilk sürümde sonsuz tool döngüsü oluşamaz.

## Endpoint

`POST /api/agent/run`

Örnek body:

```json
{
  "model": "<NVIDIA model id>",
  "agentId": "hafize-general",
  "messages": [
    { "role": "user", "content": "Hafize çalışma durumunu kontrol et." }
  ]
}
```

Bu endpoint ilk tool-calling prototipidir ve normal `/api/chat` streaming yolunu değiştirmez.

## Güvenlik sınırları

- İstemci `system` veya `tool` rolü gönderemez.
- `runtime.status` yalnızca registry'de açıkça izinli ajana sunulur.
- `repo.delete`, `repo.merge`, `secret.read`, mail gönderme veya başka harici yazma aracı eklenmedi.
- Tool args JSON olarak parse edilir; bozuk argüman reddedilir.
- Bir model yanıtında en fazla 4 tool call işlenir.
- İlk tool sonucu sonrası modelin yeni tool çağrısı yapması bu sürümde kapalıdır.
- Tool çıktısı secret değer taşımamalıdır; bu şart test ile korunur.

## Sonraki aşama

Bu altyapı doğrulandıktan sonra GitHub için ilk salt-okunur araç `repo.read` permission üzerinden eklenebilir. GitHub token server-side kalmalı, repo/path allowlist uygulanmalı ve model token değerini hiçbir zaman görmemelidir.
