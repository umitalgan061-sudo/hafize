# Reviewer quality gates

`lib/reviewer-quality-gates.mjs` dört kalite sözleşmesini aynı değerlendirme yüzeyinde toplar: credential hygiene, evidence contract ve UI finish başlıkları ile blocker/high seviyelerini release kararına dönüştürür.

Credential gate `.env`/private-key benzeri dosya yollarını ve secret pattern'lerini blocker olarak işaretler. Evidence gate, dış iddia üretildiğinde kaynak + not bulunmasını bekler. UI gate responsive, keyboard, visible focus, contrast, empty/loading/error state kanıtlarını ayrı kontrol eder.

Bu katman statik ve deterministic'tir; GitHub, model veya dış servis çağırmaz. Amaç reviewer agent'ların aynı DoD dilini paylaşması ve “görünüşte tamamlandı” sonuçlarının ölçülebilir blocker'larla ayrıştırılmasıdır.
