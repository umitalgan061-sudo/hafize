# Schedule scope counts contract

## Amaç

Zamanlanmış görev UI'si `all`, `active`, `history` ve `failed` görünümlerinin gerçek owner-scoped toplamlarını, bütün görev gövdelerini yüklemek zorunda kalmadan gösterebilmelidir.

## Güvenlik sınırı

- Sayılar yalnız authenticated `GET /api/schedules` cevabında üretilir.
- `commands.list` zaten authenticated principal ile owner isolation uygular; sayımlar bu owner-scoped çıktıdan sonra hesaplanır.
- `scopeCounts` yalnız dört tam sayı alanı içerir: `all`, `active`, `history`, `failed`.
- Task metni, `ownerId`, `traceId`, `lastError`, provider sonucu, token, cookie veya credential count metadata içine kopyalanmaz.
- Alanlar explicit allowlist ile üretilir; gelecekte store kaydına yeni alan eklenmesi count payload'ını genişletmez.
- Sayaçlar en fazla 1.000.000 owner kaydı için kabul edilir. Bu sınır aşılırsa response sessizce yanlış sayı döndürmek yerine fail-closed olur.

## Durum kümeleri

- `active`: `scheduled`, `running`
- `history`: `completed`, `failed`, `cancelled`
- `failed`: yalnız `failed`
- `all = active + history`
- `failed <= history`

Bu invariant'lar response'a eklenmeden önce yeniden doğrulanır.

## Pagination ve snapshot

Scope sayıları snapshot girdisi değildir. Mevcut snapshot, yalnız seçilmiş scope'taki canonical schedule alanlarından hesaplanmaya devam eder. Böylece başka bir scope'taki ilgisiz değişiklik mevcut scope pagination zincirini gereksiz yere bozmaz.

`listMeta.scopeCounts` pagination olsun veya olmasın başarılı list response'una eklenebilir. Mevcut `returned`, `total`, `offset`, `nextOffset`, `truncated` ve `snapshot` alanları varsa korunur.

## Geriye uyumluluk

Bu değişiklik additive'dir. İstemciler `scopeCounts` alanını yok sayabilir. Mevcut `scope`, `view`, `limit`, `offset` ve `snapshot` query sözleşmesi değişmez; yeni endpoint veya write capability eklenmez.
