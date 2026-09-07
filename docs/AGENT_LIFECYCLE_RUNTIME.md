# Agent lifecycle runtime

`lib/agent-lifecycle.mjs` alt ajan koşularını açık bir durum makinesiyle yönetir: `running`, `completed`, `failed`, `cancelled`.

Her koşu kendi `AbortController` sinyalini taşır. Parent signal iptal edilirse canlı child `PARENT_ABORTED` ile kapanır ve geç gelen başarılı sonuç terminal durumu geri çeviremez. Eşzamanlı koşu sayısı 1–8 aralığında sınırlandırılır; mesaj inbox'ı da bounded tutulur.

Kapanmış koşuya mesaj gönderimi sessizce yok sayılmaz. `AGENT_RUN_NOT_ACCEPTING_MESSAGES` ile reddedilir; kuyruk doluluğu ayrıca `AGENT_INBOX_FULL` olarak görünür.

Bu tur lifecycle çekirdeğini sağlar. Mevcut `agent-delegation` wiring'i geriye dönük uyumlu bırakıldığı için entegrasyon ayrı bir stacked adım olarak yapılabilir.
