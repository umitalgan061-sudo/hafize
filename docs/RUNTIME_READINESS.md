# Runtime readiness

Yeni security, PWA, skills, memory, schedule, connector ve model sözleşmelerini tek bir hazır olma raporunda toplamak için `lib/runtime-readiness.mjs` eklendi.

`ready` yalnız blocker veya unknown kalmadığında true olur; warning `ready` değerini düşürmez. Warning varsa ayrıca `degraded: true` raporlanır. İki bayrak birlikte okunur: `ready && !degraded` üretime hazır, `ready && degraded` uyarıyla çalışıyor, `!ready` ise blocker veya doğrulanmamış component var demektir.

Aggregator provider çağırmaz ve kendi başına health check çalıştırmaz; component sahipleri doğruladıkları sonucu bu contract'a besler.
