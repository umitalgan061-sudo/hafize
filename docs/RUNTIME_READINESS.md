# Runtime readiness

Yeni security, PWA, skills, memory, schedule, connector ve model sözleşmelerini tek bir hazır olma raporunda toplamak için `lib/runtime-readiness.mjs` eklendi.

`ready` yalnız her component `ready` olduğunda true olur; blocker, unknown veya warning kalması bunu engeller. Blocker yokken warning varsa sistem `degraded` işaretlenir. `ready` ile `degraded` birbirini dışlar; böylece “çalışıyor” ile “üretime hazır” ayrımı netleşir.

Aggregator provider çağırmaz ve kendi başına health check çalıştırmaz; component sahipleri doğruladıkları sonucu bu contract'a besler.
