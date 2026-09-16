# Schedule Edit Dependencies

Edit özelliği yeni runtime dependency eklemez.

`task-schedule-store` mevcut schedule persistence store'unu kullanır.

`schedule-command-boundary` mevcut agent registry ve credential policy'ye bağlanır.

`schedule-http-api` mevcut auth ve normalized API error contract'ı kullanır.

Frontend mevcut `scheduled-tasks.js` ve CSS asset'lerini genişletir.

Service worker yeni API cache davranışı eklemez.

Redis lease, NVIDIA executor ve worker loop için yeni bağımlılık yoktur.

Bu nedenle deployment image/runtime footprint'i yalnız kaynak kod değişimi kadar artar.
