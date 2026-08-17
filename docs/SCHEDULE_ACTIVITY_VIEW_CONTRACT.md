# Schedule Activity View Contract

## Amaç

`Görev aktivitesi` görünümü, cloud schedule worker'ın mevcut kayıtlarından güvenli bir çalışma özeti üretir. Yeni görev yürütme yetkisi açmaz; yalnız authenticated `GET /api/schedules` sonucunu kullanıcıya daha anlaşılır hale getirir.

## Gösterilen alanlar

Kart yalnız aşağıdaki bounded alanları işler:

- `scheduleId`: yalnız deduplication için kullanılır; görünür metin olarak basılmaz.
- `agentId`: en fazla 120 karakter.
- `status`: yalnız `scheduled`, `running`, `completed`, `failed`, `cancelled` allowlist'i.
- `attempts` / `maxAttempts`: yalnız 0–5 / 1–5 aralıkları.
- `runAt`, `createdAt`, `updatedAt`: geçerli ISO tarih-saat değerleri.

Kart özellikle `task`, `lastError`, `traceId`, `ownerId`, connector bilgisi, prompt, model çıktısı, token veya credential göstermez. Ham backend hata kodu kullanıcı arayüzüne taşınmaz.

## Aktivite semantiği

- `scheduled + attempts=0`: görev henüz çalışmadı.
- `scheduled + attempts>0`: önceki deneme tamamlandı ve görev yeniden deneme bekliyor.
- `running`: mevcut deneme çalışıyor.
- `completed`: görev başarılı biçimde tamamlandı.
- `failed`: bounded denemelerden sonra görev başarısız durumda.
- `cancelled`: görev çalışmadan veya bazı denemelerden sonra kullanıcı tarafından iptal edildi.

İlerleme çubuğu işin yüzde tamamlanmasını temsil etmez; yalnız kullanılan deneme sayısını `attempts/maxAttempts` olarak görselleştirir.

## Filtreler

`Tümü`, `Aktif` ve `Geçmiş` filtreleri yalnız tarayıcı içi görünüm filtresidir.

- `Aktif`: `scheduled` + `running`.
- `Geçmiş`: `completed` + `failed` + `cancelled`.
- Filtre tercihi storage'a yazılmaz ve backend sorgusunu değiştirmez.

## Ağ ve authentication sınırı

Tek veri isteği mevcut `/api/schedules` endpoint'ine yapılan same-origin GET'tir:

- `method: GET`
- `credentials: same-origin`
- `cache: no-store`
- `Accept: application/json`

POST, PATCH, DELETE veya connector çağrısı yoktur. Authorization/Bearer token, HttpOnly session cookie değeri veya signing key JavaScript tarafından okunmaz.

Cloud session badge `loading` dışındaki anlamlı bir duruma geçtiğinde kart authoritative GET ile yeniden yüklenebilir. Create/cancel/reschedule event'leri de aynı GET'i tetikler. Devam eden bir istek varsa refresh tek pending işarete coalesce edilir.

## Veri doğrulama

En fazla 50 benzersiz kayıt kabul edilir. Duplicate schedule ID, bilinmeyen status, geçersiz tarih, `attempts > maxAttempts`, `scheduled` iken tüm denemelerin tüketilmiş olması veya running/completed/failed iken sıfır deneme bulunması fail-closed reddedilir.

Sıralama `updatedAt ?? createdAt` zamanına göre en yeni aktivite önce olacak şekildedir. `updatedAt` yoksa güvenli biçimde `createdAt` kullanılır.

## Güvenlik

Bu katman:

- `lastError` veya iç sistem hata kodunu göstermez,
- görev prompt/metnini ikinci kez render etmez,
- localStorage/sessionStorage/IndexedDB/cookie/clipboard kullanmaz,
- HTML parse etmez; görünür içerik yalnız `textContent` ile üretilir,
- tool permission, provider routing veya agent registry değiştirmez,
- external write/send/merge approval sınırını gevşetmez.

## Erişilebilirlik

Filtreler gerçek button öğeleri ve `aria-pressed` durumu kullanır. Kart `aria-busy`, status satırı `role=status` + `aria-live=polite` kullanır. Deneme göstergesi native `progress` öğesidir ve `x/y deneme kullanıldı` erişilebilir adı taşır. Mobil dokunma hedefleri, reduced-motion ve forced-colors davranışları CSS sözleşmesinde korunur.

## Geri alma

Revert için `schedule-activity.js`, `schedule-activity.css`, ilgili testler/belge ve shell loader/PWA kayıtları kaldırılır. Schedule store, worker, API, authentication veya kalıcı veri şemasında migrasyon yoktur.
