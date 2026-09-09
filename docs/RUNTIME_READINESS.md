# Runtime readiness

Yeni security, PWA, skills, memory, schedule, connector ve model sözleşmelerini tek bir hazır olma raporunda toplamak için `lib/runtime-readiness.mjs` eklendi.

`ready` yalnız blocker, unknown ve warning kalmadığında true olur. Warning varsa sistem `degraded` olarak işaretlenir ve `ready` false kalır; böylece “çalışıyor” ile “üretime hazır” ayrımı netleşir. `ready` ile `degraded` aynı anda true olamaz.

Aggregator provider çağırmaz ve kendi başına health check çalıştırmaz; component sahipleri doğruladıkları sonucu bu contract'a besler.
