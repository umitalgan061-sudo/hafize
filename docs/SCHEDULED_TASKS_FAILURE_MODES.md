# Zamanlanmış Görevler — Failure Modes

## Authentication failure

**Belirti:** Panel listesi 401 döndürür veya görev oluşturma başarısız olur.

**UI davranışı:** Kullanıcıya oturum açması gerektiği bildirilir.

**Operasyon:** Uygulama session/auth katmanı incelenir.

**Rollback etkisi:** Yok; schedule verisi korunur.

## Invalid agent

**Belirti:** POST 400 `INVALID_AGENT` döndürür.

**UI davranışı:** Görev oluşturulmadı mesajı gösterilir.

**Operasyon:** Agent registry ve public agent listesi incelenir.

## Empty task

**Belirti:** Kullanıcı task alanını boş bırakır.

**UI davranışı:** İstek gönderilmeden validation mesajı görünür.

**Operasyon:** Gerekmez.

## Oversized task

**Belirti:** 20.000 karakter üstü içerik vardır.

**UI davranışı:** Native maxlength ve client validation sınırı uygular.

**Backend:** Command boundary tekrar doğrular.

## Past runAt

**Belirti:** Seçilen zaman geçmiştedir.

**UI davranışı:** POST gönderilmez.

**Backend:** Store ISO/time validation uygular.

## Invalid datetime

**Belirti:** Browser input beklenmeyen bir değere sahiptir.

**UI davranışı:** `isoFromLocal` boş döner ve validation hata verir.

## Capacity reached

**Belirti:** POST 503 `SCHEDULE_CAPACITY_REACHED` döndürür.

**UI davranışı:** Görev kapasitesinin dolduğu bildirilir.

**Operasyon:** Store capacity ve cleanup politikası incelenir.

**Otomatik silme:** UI yapmaz.

## Network failure

**Belirti:** Fetch exception verir.

**UI davranışı:** Liste yüklenemedi/servise ulaşılamadı mesajı görünür.

**Veri:** Form alanları kullanıcı aksiyonu olmadan silinmez.

## Malformed JSON

**Belirti:** Server 2xx olmayan veya JSON olmayan response döndürür.

**UI davranışı:** `safeJson` null döndürür ve status üzerinden hata oluşturulur.

**Güvenlik:** Raw response HTML olarak DOM'a eklenmez.

## Cancel race

**Belirti:** Kullanıcı cancel tıklarken worker görevi running durumuna getirir.

**Beklenen:** Backend 409 veya eşdeğer cancellable-state hatası döndürür.

**UI:** Liste yeniden okunur ve güncel status gösterilir.

## Unknown status

**Belirti:** Gelecekte backend yeni status yayınlar.

**UI:** Status text fallback olarak `Bilinmiyor` gösterilir.

**Filtre:** Unknown kayıt tüm durumlarda görünür, bilinmeyen özel filter seçeneği sunulmaz.

## Worker delay

**Belirti:** runAt geçmiş olsa da status uzun süre scheduled kalır.

**UI:** runAt ve mevcut status gösterilir.

**Operasyon:** Schedule worker tick, lease ve execution runtime incelenir.

## Execution timeout

**Belirti:** Worker execution timeout sonrası failed/retry state oluşur.

**UI:** lastError varsa bounded error code gösterilir.

**UI retry:** Ayrı retry endpoint çağırmaz.

## Storage startup failure

**Belirti:** Durable storage açılamaz ve server startup başarısız olur.

**UI etkisi:** Görev paneli erişilemez.

**Operasyon:** Encryption/storage config incelenir.

## Stale PWA cache

**Belirti:** Kullanıcı eski static UI görür.

**Savunma:** Cache version bump.

**API:** `/api/` cachelenmez.

## Secret leak

**Belirti:** Client bundle'da schedule token görülür.

**Durum:** Release blocker.

**Kontrol:** Source security test.

## Ownership leak

**Belirti:** GET başka kullanıcının schedule'ını döndürür.

**Durum:** Critical release blocker.

**Kontrol:** Backend command boundary review.

## Unsafely rendered task

**Belirti:** Task text markup olarak yorumlanır.

**Durum:** Security blocker.

**Kontrol:** Client source test; DOM API review.

## Excessive polling

**Belirti:** Panel kapalıyken veya görünümden uzakken GET çağrıları sürer.

**Savunma:** Interval panel kapanırken temizlenir.

## Duplicate submit

**Belirti:** Kullanıcı planla düğmesine hızlıca iki kez basar.

**Savunma:** Submit button request sırasında disabled.

**Not:** Backend yine idempotent olmadığı için client guard önemlidir; gerçek duplicate semantics backend tarafından ayrıca ele alınmaz.

## Accidental cancel

**Belirti:** Kullanıcı yanlış task üzerinde iptal seçer.

**Savunma:** Native confirm onayı.

## Trace confusion

**Belirti:** Trace ID yanlış kopyalanır veya UI tarafından üretilir.

**Savunma:** Server-generated ID yalnızca readonly gösterilir.

## Accessibility regression

**Belirti:** Dialog adı, label veya focus davranışı kaybolur.

**Durum:** Release blocker.

**Kontrol:** Accessibility source test + manual keyboard review.

## Mobile overflow

**Belirti:** Modal ekran dışına taşar.

**Savunma:** max-height, overflow, mobile single-column CSS.

## Recovery principle

Hata durumunda UI server state'i tahmin etmez.

Önce hata sınıfı gösterilir, sonra kullanıcı kontrollü refresh ile gerçek snapshot alınabilir.

Client hiçbir failure mode için schedule storage'ını temizlemez.
