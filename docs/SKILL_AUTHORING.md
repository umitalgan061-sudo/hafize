# Skill yazımı (`skill_create`)

`lib/skill-authoring.ts`, modelin tekrarlanabilir bir beceriyi bir kez öğrenip kalıcı hâle
getirmesini sağlayan yazım katmanıdır. Ajan bir skill manifesti verir; bu katman doğrular,
sandbox kodunu sağlık kontrolünden geçirir, dosyaları yazar ve registry'ye canlı kaydeder.
Sonraki çağrılar `skill_invoke` ile yapılır.

Böylece "her seferinde sıfırdan türet" yerine "bir kez tanımla, tekrar kullan" davranışı mümkün
olur.

## Akış

1. Manifest `normalizeSkillManifest` ile **built-in skill'lerle aynı** doğrulayıcıdan geçer.
   Hatalı manifest kayıt sırasında değil, en başta reddedilir.
2. `allowedTools` + `requiredScopes` ajanın kendi yetkileriyle karşılaştırılır. Ajan kendi
   policy'sinde olmayan bir yetki isteyemez → `SKILL_TOOL_ESCALATION:<tool>`.
3. Mevcut dosyalar `.backup/<name>-<timestamp>/` altına yedeklenir.
4. `handler.type === "sandbox"` ise kod `sandbox.run` ile **kayıttan önce** bir kez çalıştırılır.
   Hata verirse `SKILL_HEALTH_CHECK_FAILED` döner ve hiçbir dosya yazılmaz.
5. Manifest `skills/user/<name>.json`, versiyon bilgisi `<name>.meta.json`, sandbox kodu ise
   manifestte adı geçen dosyaya yazılır.
6. Aynı isimde bir skill varsa `unregister` + `register` ile değiştirilir; versiyon
   `1.2.3 → 1.2.4` biçiminde yükseltilir.

Herhangi bir adım başarısız olursa `restore()` çalışır: yeni yazılan dosyalar silinir, yedekler
geri konur. Yani reddedilen bir skill **yarım kalmaz**.

## Versiyon neden manifestte değil?

`skills-manifest.ts` sözleşmesinde `version` alanı yoktur (bilinmeyen üst alanlar
`INVALID_SKILL_FIELD` ile reddedilir). Bu yüzden versiyon `skills/user/<name>.meta.json`
yan dosyasında tutulur; manifest şeması temiz kalır ve imzalı bundle sözleşmesi bozulmaz.

## Güvenlik sınırları

| Kural | Kod |
| --- | --- |
| Ajan kendi yetkisinden geniş skill yazamaz | `SKILL_TOOL_ESCALATION:<tool>` |
| `handler.type: "sandbox"` için kod zorunlu, yoksa reddedilir | `INVALID_SKILL_CODE` |
| Sandbox kodu 40 KB'ı aşamaz | `SKILL_CODE_TOO_LARGE` |
| `require`, `process.env`, `node:fs`, `child_process` gibi API'lar erken reddedilir | `SKILL_CODE_FORBIDDEN_API` |
| Kodda credential kalıbı taşınamaz | `SKILL_CODE_SECRET_MATERIAL` |
| Sandbox handler'ı olmayan beceriye kod verilemez | `SKILL_CODE_WITHOUT_HANDLER` |
| Sağlık kontrolü geçemeyen kod kaydedilmez | `SKILL_HEALTH_CHECK_FAILED` |
| Aynı isimde iki skill çakışmaz (kayıt sırasında replace edilir) | `RULE_NAME_CONFLICT` benzeri `SKILL_SOURCE_CONFLICT` |

Sandbox'un kendisi gerçek sınırdır; buradaki kalıp kontrolleri yalnızca açıkça tehlikeli
şekilleri erkenden durdurmak için vardır.

## Geri alma

`skill_create` bir action journal kaydı üretir. Kullanıcı `action_undo` ile son skill
değişikliğini geri alabilir; journal kaydı kaldırılan skill'i saklar ve geri yükleme yapar.

## Tool tanımı

`lib/tool-runtime.ts` içinde `skill_create` (permission `skill.create`):

```json
{
  "manifest": { "type": "object" },
  "code": { "type": "string" },
  "healthCheck": { "type": "object" }
}
```

`agents/registry.json` içinde `agency-minimal-engineer`, `agency-code-reviewer` ve
`hafize-general` ajanları bu izne sahiptir.

## Test

`npx vitest run lib/skill-authoring.test.ts` — 10 test: versiyon yükseltme, kayıt, yetki
yükseltme reddi, geçersiz manifest, secret reddi, yasak API reddi, handler'sız kod reddi,
sağlık kontrolü, güncelleme ve **başarısızlıkta önceki dosyaların geri yüklenmesi**.
