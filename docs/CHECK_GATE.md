# Kontrol kapısı

Hafize'nin tam doğrulama girişi `npm run check` ve `npm test` komutlarının çağırdığı `scripts/run-checks.mjs` koşucusudur.

Koşucu kök `*.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` kaynaklarını `node --check` ile tarar. Ardından `scripts/validate-*.mjs` doğrulama paketleri ile `scripts/test-*.mjs` test paketlerini diskten otomatik keşfedip ayrı alt süreçlerde çalıştırır. Paket başına 120 saniye, syntax için 30 saniye sınırı vardır; en fazla dört paket paralel çalışır ve ilk hatada durulmaz.

Her child-process stdout/stderr akışı en fazla 64 KiB tutulur. Daha büyük çıktı `OUTPUT_TRUNCATED` ile işaretlenir; böylece hata raporlama yapılırken sınırsız bellek birikimi oluşmaz.

Yeni bir doğrulama veya test dosyası eklendiğinde `package.json` içine ayrıca yol eklemek gerekmez. `--list` keşfedilen paketleri, `--filter=a,b` ise eşleşen odak paketleri listeler/çalıştırır. Filtre geliştirici döngüsü içindir; PR öncesi filtresiz tam kapı kullanılır.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.

## Açık kalan iki paket ve gereken karar

`test-skills-runtime.mjs` ve `test-tool-runtime.mjs` bilerek kırmızı bırakıldı;
sebep bir hata değil, iki dokümanın çelişen skill sözleşmesi:

- `docs/SKILLS_REGISTRY.md`: skill'in `allowedTools` listesindeki **her** araç
  ajan policy'sinde de izinli olmalıdır, aksi hâlde `SKILL_TOOL_ESCALATION`
  ve skill ajana hiç görünmez. `lib/skills-registry.mjs` ve yeşil olan
  `test-skills-registry.mjs` bu davranışı uygular.
- `docs/SKILLS_RUNTIME.md`: `resolveForAgent()` "ajanın zaten sahip
  olabileceği yetkilerle **kesişen**" araçları döndürür. Kırmızı iki paket bu
  okumaya göre yazılmış.

Pratik sonuç: `skills/builtin.json` içindeki `code-inspection` skill'i
`repo.read` + `runtime.status` istiyor; `agents/registry.json` içinde bu ikisine
birden sahip ajan yok, dolayısıyla skill hiçbir ajan tarafından çalıştırılamıyor.
Kırmızı testler ayrıca `hafize-general` ajanının "kod incele" isteğini
seçebilmesini bekliyor; bu ancak primary ajana `repo.read` verilirse mümkün.

Karar kullanıcıya aittir, üç seçenek var:

1. `hafize-general` policy'sine `repo.read` eklenir (primary ajan allowlist'li
   GitHub okumasını doğrudan yapar) ve `code-inspection` olduğu gibi kalır.
2. Kesişim semantiği benimsenir: registry hard-fail yerine izin verilen araç
   alt kümesiyle çözer; `SKILLS_REGISTRY.md` ve `test-skills-registry.mjs`
   güncellenir.
3. Sıkı semantik korunur, `code-inspection` yalnız `repo.read` ister ve skill
   primary ajana değil reviewer/engineer ajanlarına açık kalır.

Seçenek 1 ve 2 ajan yetki sınırını genişlettiği için otomatik self-development
turunda uygulanmadı.
