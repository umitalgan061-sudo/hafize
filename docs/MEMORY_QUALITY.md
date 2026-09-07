# Memory retrieval quality

Personal memory store artık owner-scope doğrulamasından sonra deterministic bir sıralama katmanı kullanıyor. Ranking; lexical match, memory kind sinyali ve recency bileşenlerini sabit ağırlıklarla birleştirir ve memoryId ile deterministik tie-break uygular.

Bu katman embedding veya dış model çağrısı yapmaz. Amaç mevcut salt-okunur memory retrieval davranışını ölçülebilir kılmak ve aynı veri + aynı zaman girdisinde aynı sıralamayı üretmektir.

`measureRetrievalQuality()` küçük bir kabul testi yüzeyi sağlar: precision@k, recall@k, top-hit ve minimum puan eşiğini raporlar. Owner ayrımı ranking'den önce yapılır; başka kullanıcıya ait kayıtlar hiçbir kalite skorlamasına girmez.
