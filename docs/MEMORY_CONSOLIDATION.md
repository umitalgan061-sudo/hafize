# Hafize kişisel bellek konsolidasyonu

`docs/CLAUDE_RESEARCH_INTEGRATION.md` sırasındaki "memory consolidation"
adımının ilk katmanı: kullanıcının belleğinde biriken tekrarları sessiz silme
yerine kullanıcı onayına bağlı bir planla azaltmak.

Uygulama `lib/memory-consolidation.mjs`, testler
`scripts/test-memory-consolidation.mjs`.

## Güvenlik sınırları

- Owner-scoped: her kaydın `ownerId` değeri istenen sahiple aynı olmalıdır,
  aksi hâlde `MEMORY_CONSOLIDATION_OWNER_MISMATCH`.
- Katman hiçbir kaydı silmez; yalnız `personal-memory-contract` uyumlu silme
  komutu üretir, silmeyi çağıran taraf store üzerinden yapar.
- Komut üretimi `explicitUserIntent: true` ve onaylanmış grup kimlikleri
  olmadan çalışmaz (`MEMORY_CONSOLIDATION_REQUIRES_EXPLICIT_USER_INTENT`).
- Korunan kayıt silme komutuna dönüştürülemez; kurcalanmış planda
  `MEMORY_CONSOLIDATION_KEEP_RECORD_PROTECTED` döner.
- Model çağrısı ve yeni içerik üretimi yoktur; korunan kayıt her zaman
  kullanıcının kendi mevcut kaydıdır, bu da bilgi uydurma riskini kaldırır.
- Plan yalnız 200 karakterlik önizleme taşır ve sahibine gösterilir.

## Gruplama kuralı

Karşılaştırma yalnız aynı `kind` içinde, normalize edilmiş (NFKC, `tr-TR`,
noktalamasız) token kümeleri üzerinde Jaccard oranıyla yapılır; varsayılan eşik
`0.86`, izinli aralık `0.6`–`1`. Her grupta en yeni kayıt korunur
(`newest_owner_statement`), eşitlikte `memoryId` sırası deterministiktir.
`maxGroups` 50, `maxRecords` 512.

## Akış ve geri alma

```
store.snapshot().entries
  → planMemoryConsolidation({ ownerId, records })
  → kullanıcıya plan gösterimi (grup, korunan kayıt, adaylar, benzerlik)
  → normalizeConsolidationApproval({ ownerId, plan, approvedGroupIds, explicitUserIntent: true })
  → store.remove(command)   // her komut exactMatch: true taşır
```

Katman saf bir modüldür, server wiring'i yoktur: iki dosya ve `package.json`
kontrol satırı kaldırılırsa mevcut bellek davranışı değişmeden geri alınır.
Sıradaki adım onaylı planın authenticated owner'a bağlı HTTP sınırıdır.
