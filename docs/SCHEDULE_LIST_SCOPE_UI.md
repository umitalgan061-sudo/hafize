# Server-backed schedule filter UI

Bu belge `SCHEDULE_LIST_SERVER_SCOPES.md` içindeki backend contract'ının Hafize web/PWA kartına nasıl bağlandığını tanımlar.

## Davranış

Durum sekmeleri artık yalnız mevcut DOM kayıtlarını saklayan görsel filtreler değildir. Kullanıcı `Tümü`, `Aktif`, `Geçmiş` veya `Başarısız` sekmesine geçtiğinde `schedule-list-filter.js` yalnız bounded `{ scope }` detail taşıyan `hafize:schedule-scope-changed` event'ini yayınlar. `schedule-list.js` bu scope'u kendi allowlist'iyle yeniden normalize eder, mevcut offset/snapshot zincirini siler ve ilk sayfayı yeni scope ile yeniden ister.

Her scope için istek biçimi sabittir:

`GET /api/schedules?limit=100&view=summary&scope=<scope>`

Sonraki sayfa aynı scope, offset ve o scope'un snapshot'ı ile yüklenir. Bir scope'un snapshot'ı başka scope'a taşınmaz.

## Yarış güvenliği

Scope değişimi request devam ederken gelirse yeni scope `pendingScope` olarak tutulur. Eski response döndüğünde `requestScope !== currentScope` kontrolü stale sonucu DOM'a uygulamayı engeller. Aktif request cleanup'ı tamamlanınca en son pending scope ilk sayfadan yüklenir. Böylece hızlı sekme tıklamalarında eski scope verisi yeni sekmenin altına karışmaz.

Mutation refresh, session refresh ve snapshot-409 restart davranışları seçili scope'u korur. Create/cancel/reschedule sonrası pagination yine offset 0'dan aynı current scope ile başlar.

## Arama semantiği

Metin araması server'a gönderilmez. Arama yalnız seçili scope içinde o ana kadar yüklenmiş bounded kartlarda çalışır; placeholder ve live-region bunu `Yüklü` ifadesiyle açıkça söyler. Bu ayrım bilinçlidir: task metnini server query parametresine taşımak log/cache/URL veri yüzeyini büyütmemelidir.

## Sayaçlar

`scope=all` durumunda mevcut yüklü kayıtlar için sekme sayaçları gösterilebilir. Server dar bir scope döndürürken diğer scope sayaçları tam kümenin sayısı değildir; bu nedenle count badge'leri gizlenir ve kullanıcıya yanlış toplam verilmez.

## Güvenlik

- Yalnız same-origin GET kullanılır.
- `credentials: same-origin` ve `cache: no-store` korunur.
- API yanıtları service-worker cache'ine girmez; `/api/*` network-only kalır.
- Scope event'inde task, scheduleId, owner, trace, token veya credential yoktur.
- Filter tercihi kalıcı storage'a yazılmaz.
- Yeni write/send/merge veya agent tool permission eklenmez.
- Kullanıcı task metni HTML olarak parse edilmez.

PWA shell cache bu değişiklik için `v86`'ya yükseltilmiştir.
