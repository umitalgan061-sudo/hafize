# TypeScript-first runtime modernizasyonu

Bu tur, Hafize backend runtime'ının çalışan kod yolunu TypeScript merkezli hale getirir. Hedef yalnızca uzantıları değiştirmek değil; güvenlik, tool-calling, connector sınırları ve request cancellation davranışlarının tek bir typed kaynak üzerinden ilerlemesidir.

## Mimari sonuç

Agent authorization, delegation, tool catalog, task handoff, model response, rate limit, session/server auth, security observability ve schedule execution yardımcılarının mevcut TypeScript kaynakları artık davranışın ana sahibi konumundadır.

Eski .mjs girişleri geriye dönük uyumluluk için korunur; fakat implementasyon taşımaz. Her biri yalnızca ilgili .ts dosyasını export eden bridge'dir. Böylece eski import yolu kırılmazken iki ayrı kod tabanının ayrışma riski azaltılır.

## Tool runtime

Tool catalog typed metadata taşır:

- tool kind
- permission
- execution timeout
- public activity labels
- model-facing schema

Her yürütme sonucu tool adı ve durationMs alanları ile ölçülebilir. Sonuç mevcut güvenlik projection katmanından geçmeye devam eder.

## İptal

server.ts request controller'ının signal değeri tool runtime'a aktarılır. Tool runtime ayrıca AbortSignal.timeout ile tool-specific süre sınırı üretir ve üst request signal'ı AbortSignal.any ile birleştirir.

Bu sözleşme cooperative cancellation mantığı kullanır. Signal'ı destekleyen fetch veya connector implementasyonu işlem yarıda kaldığında ağ çağrısını da durdurabilir.

## Connector sınırları

Canva read ve Gmail read artık typed boundary üzerinden çalışır. İzin verilen operation alanları kapalı union'larla, parametre alanları allowlist ile, owner çözümü server-side resolver ile sınırlandırılır. Model kendi owner kimliğini uydurarak erişim alanını genişletemez.

## Veri güvenliği

Runtime'daki tool sonuçları mevcut credential taraması, karmaşıklık limiti ve accessor/prototype kontrollerini korur. Typed migration bu politikaları gevşetmez.

## Doğrulama

Migration bridge kontrolü 22 core runtime modülünü tarar. Vitest tarafında task handoff, Canva read, Gmail read ve tool runtime davranışları ayrıca test edilir.

## Geri alma

PR revert edildiğinde bridge dosyaları ve TypeScript kaynakları birlikte önceki commit'e döner. Storage verisi veya dış servis credential'ları silinmez.

## Sonraki dalga

Kalan .mjs kodu aynı ilkeyle kademeli olarak TypeScript'e taşınmalıdır. Her dalga tek bir subsystem'i hedeflemeli; 3000 değişen satır bütçesi aşılmamalı ve davranışsız satır üretmekten kaçınılmalıdır.
