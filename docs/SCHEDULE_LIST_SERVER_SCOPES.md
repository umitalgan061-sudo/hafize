# Schedule list server scope contract

Hafize zamanlanmış görev listesi artık `GET /api/schedules` üzerinde isteğe bağlı, dar ve canonical bir `scope` filtresi kabul eder.

## Amaç

İstemci tarafındaki durum filtreleri yalnız o ana kadar yüklenmiş sayfaları görebilir. Kullanıcının yüzlerce eski görevi olduğunda örneğin yalnız ilk 100 kayıt yüklenmişken `Başarısız` filtresi, daha eski sayfalardaki başarısız görevleri bilmez. Server scope sözleşmesi bu eksikliği veri silmeden ve yeni bir write yüzeyi açmadan bounded pagination katmanında çözer.

## Canonical scope değerleri

Yalnız şu dört değer kabul edilir:

- `all` — tüm owner-scoped görevler; query verilmediğinde de varsayılan budur.
- `active` — yalnız `scheduled` ve `running`.
- `history` — yalnız `completed`, `failed` ve `cancelled`.
- `failed` — yalnız `failed`.

Scope serbest statü listesi değildir. Büyük/küçük harf varyantı, boşluk, virgüllü kombinasyon, bilinmeyen değer, duplicate `scope` alanı veya boş değer `INVALID_SCHEDULE_LIST_QUERY` ile HTTP 400 döner. Bu doğrulama `commands.list` çalıştırılmadan önce yapılır.

## Pagination ve snapshot sırası

İşlem sırası kasıtlı olarak şöyledir:

1. principal authenticate edilir;
2. query canonical biçimde doğrulanır;
3. owner-scoped `commands.list` sonucu alınır;
4. seçilen scope uygulanır;
5. scope içindeki kayıtlar canonical sıraya sokulur;
6. snapshot yalnız bu scope kümesinden üretilir;
7. `limit` / `offset` uygulanır;
8. istenmişse `view=summary` projection uygulanır.

Bu sıra önemlidir. Örneğin `scope=failed` ile eski başarısız görevler sayfalanırken yalnız aktif bir görevin `scheduled → running` değişmesi failed snapshot'ını bozmaz. Buna karşılık failed kümesindeki bir kaydın güncellenmesi veya başka bir görevin failed durumuna girmesi snapshot'ı değiştirir ve eski cursor 409 `SCHEDULE_LIST_SNAPSHOT_CHANGED` ile durur.

Scope değiştirmek mevcut snapshot'ı yeniden kullanma hakkı vermez. Her scope pagination zinciri offset 0'dan kendi snapshot'ıyla başlamalıdır.

## Summary veri-minimizasyonu

`scope` ile `view=summary` birlikte kullanılabilir. Summary katmanı değişmez: tarayıcıya yalnız allowlist edilmiş schedule alanları gider. `ownerId`, `traceId`, `lastError`, provider sonucu ve internal metadata scope filtresi nedeniyle yeniden response'a eklenmez.

## Güvenlik sınırı

- Scope authorization değildir; owner isolation mevcut command boundary'de kalır.
- Authentication kaldırılmaz veya query parametresine taşınmaz.
- Yeni POST/PATCH/DELETE endpoint'i yoktur.
- Yeni ajan tool yetkisi yoktur.
- External write/send/merge approval sözleşmeleri değişmez.
- Secret, token veya credential scope/snapshot üretimine girmez.
- Scope helper network, storage, shell veya credential yüzeyi açmaz.
- Aktif roster iki selector + iki specialist olmak üzere dört profildir ve default-deny tool policy korunur.

## Geri uyumluluk

`scope` verilmezse davranış `scope=all` ile aynıdır. Mevcut `limit`, `offset`, `snapshot` ve `view=summary` istemcileri aynı endpoint'i kullanmaya devam eder.

## İzleyen UI adımı

Bu PR server contract'ını güvenli ve testli biçimde kurar. Mevcut local filter UI henüz bu parametreyi kullanmaz; onu server scope'a bağlamak ayrı bir istemci davranış değişikliğidir ve yeni request-generation/snapshot reset testleriyle tek amaçlı follow-up olarak yapılmalıdır. Bu ayrım, backend contract ile UI lifecycle değişikliğini aynı PR'da gereksiz yere birbirine bağlamaz.
