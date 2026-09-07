# Hafize kişisel bellek konsolidasyonu

`planMemoryConsolidation()` aynı kullanıcıya ait aynı türdeki benzer kayıtları deterministic bir plan altında gruplar. Karşılaştırma NFKC + Türkçe küçük harf normalizasyonu ve token Jaccard benzerliğiyle yapılır; eşik aralığı sınırlıdır ve grup başına en yeni kayıt korunur.

Katman hiçbir kaydı kendisi silmez. `normalizeConsolidationApproval()` yalnızca `explicitUserIntent: true`, aynı `ownerId` ve plan içinde açıkça seçilmiş grup kimlikleri varsa `personal-memory-store.remove()` ile uyumlu exact-match komutları üretir. Korunan kayıt komuta dönüştürülemez.

Girdi, kayıt sayısı, grup sayısı, içerik ve önizlemeler bounded tutulur; secret üretimi, model çağrısı veya dış sağlayıcı erişimi yoktur. Bu PR HTTP/server wiring eklemez; sonraki adım authenticated owner'a bağlı onay yüzeyidir.
