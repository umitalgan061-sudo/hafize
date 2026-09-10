# Runtime readiness

Yeni security, PWA, skills, memory, schedule, connector ve model sözleşmelerini tek bir hazır olma raporunda toplamak için `lib/runtime-readiness.mjs` eklendi.

`ready` yalnız blocker, unknown ve warning kalmadığında true olur. Warning varsa sistem `ready: false, degraded: true` olarak işaretlenir; böylece “çalışıyor” ile “üretime hazır” ayrımı netleşir ve iki bayrak aynı anda true olmaz.

Aggregator provider çağırmaz ve kendi başına health check çalıştırmaz; component sahipleri doğruladıkları sonucu bu contract'a besler.
