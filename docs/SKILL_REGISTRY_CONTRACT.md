# Skill registry sözleşmesi

Bu katman Claude araştırma planındaki 2. maddenin (`strict skills manifest + registry + inline/fork execution contract`) ikinci adımıdır. `lib/skill-manifest.mjs` tek bir manifest'in sınırını tanımlar; `lib/skill-registry.mjs` bu manifest'lerden kaynak öncelikli, gölgeleme kurallı ve daraltıcı yetkili bir registry kurar. **Henüz tool catalog kaydı veya skill çalıştıran bir araç eklenmez**; bu katman yalnız hangi skill'in yüklendiğini ve hangi aracı kullanabileceğini belirler.

## Kaynak önceliği ve gölgeleme

`createSkillRegistry({ builtin, user, project, allowedProjectScopes })` kaynakları `builtin > user > project` sırasıyla yükler. Aynı ada sahip bir skill daha yüksek öncelikli bir kaynakta zaten varsa düşük öncelikli kayıt **yüklenmez**; `SHADOWED_BY_HIGHER_PRIORITY_SOURCE` nedeniyle `listRejected()` içine düşer.

Bu yön bilinçlidir: proje deposundan gelen bir metin, kullanıcının veya ürünün kendi skill adını ele geçiremez.

Aynı kaynak içindeki tekrar ad `DUPLICATE_SKILL_NAME` ile reddedilir; ilk kayıt korunur.

## Project kapsamı

`project` kaynaklı skill yalnız `allowedProjectScopes` içinde açıkça listelenen kapsamdan yüklenir. İzin verilmeyen kapsam `PROJECT_SCOPE_NOT_ALLOWED` ile reddedilir; kapsam listesi verilmezse hiçbir project skill'i yüklenmez.

## Hata dayanıklılığı

Geçersiz veya credential taşıyan bir manifest registry'yi bozmaz. Her reddedilen kayıt `{ source, index, reason, name }` olarak tutulur; `reason` yalnız sabit hata kodudur, manifest içeriği (prompt, açıklama, olası secret) rapora kopyalanmaz.

Kaynak listesi dizi değilse veya kaynak başına 64 kaydı aşıyorsa registry `INVALID_SKILL_SOURCE_LIST:<source>` ile kurulmaz; bu, tek bir bozuk kaynağın sessizce yarım yüklenmesini engeller.

## Yetki daraltma

`authorizeSkillTool(agent, skill, permission, { approvalGranted })` kararı iki aşamalıdır:

1. `authorizeAgentTool()` çağrılır. Agent policy'si izni vermiyorsa karar aynen döner (`default_deny`, `explicit_deny`, `approval_required`).
2. Skill kendi `allowedTools` listesini bildirmişse ve izin bu listede değilse `skill_scope_denied` döner.

Yani `allowedTools` **yetki kaynağı değildir**, yalnız daraltıcıdır. Boş liste daraltma yapmaz; karar tamamen agent policy'sine bırakılır. Onay gerektiren izinler skill üzerinden otomatik onay kazanmaz; `approvalGranted` yalnız backend onay kapısından gelir.

`authorizeSkill(agent, skill)` skill'in bildirdiği araçların tamamı karşılanıyorsa çalıştırılabilir kabul eder; agent verilmezse `invalid_agent` ile reddeder. `registry.listForAgent(agent)` yalnız bu koşulu sağlayan skill'leri döndürür; böylece model gerçekten kullanılamayacak bir skill'i görmez.

## Tetikleyici eşleşmesi

`matchTrigger(text)` küçük harfe indirgenmiş **tam** eşleşme arar; kısmi metin eşleşmesi yapmaz. Bu, model veya dış metin tarafından istenmeyen skill tetiklenmesini zorlaştırır.

## Sıradaki adım

`inline` / `fork` execution ayrımının çalışma zamanı karşılığı (fork alt görevinin parent agent policy'sini aşamaması, cancellation ve concurrency sınırları) araştırma planındaki 3. maddeyle birlikte ele alınacaktır. Bu tur, tur başına 500 satır diff bütçesi nedeniyle registry ve yetki daraltma sınırında durdurulmuştur.
