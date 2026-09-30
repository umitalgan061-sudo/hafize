# Smart Fill Durum Makinesi

## States

- `closed`: panel görünmez.
- `open`: aktif prompt ve değişken alanları hazırdır.
- `editing`: input değerleri değişirken preview güncellenir.
- `preset-selected`: seçili set değerleri forma uygulanmıştır.
- `error`: kullanıcıya kısa bir durum mesajı gösterilir.

## Transitions

`Kullan` → `open` yalnız değişkenli promptlarda çalışır.

`open` → `editing` ilk değer girişiyle oluşur.

`editing` → `preset-selected` preset seçimiyle gerçekleşir.

Her form değişimi tekrar `editing` durumunu besleyebilir.

`editing` → `closed` `Mesaja aktar`, `Vazgeç` veya Escape ile olur.

`error` → `open` kullanıcı düzeltme yaptığında kalabilir; kritik hata uygulamanın dışına taşmaz.

## Invariants

Aktif prompt id olmadan değer işlenmez. Değişken listesi maksimum 12'dir. Her değer maksimum 1000 karakterdir. Preview maksimum 8000 karakterdir.

## Focus invariant

Panel açıksa odaklanabilir alanlar panel içinde tutulur. Kapanınca son odak elemana dönülür.

## Storage invariant

Preset yazma işlemi prompt id prefix'i ile sınırlandırılır. Ana Prompt Library kaydı Smart Fill tarafından doğrudan yazılmaz.

## Submit invariant

Hiçbir state transition form submit çağrısı üretmez. Son kullanıcı gönderimi ayrı composer davranışıdır.

## Lifecycle invariant

Destroy sonrası observer ve event listener'lar kaldırılır. Aynı kart üzerine ikinci mount edilmez.

## Error handling

Invalid JSON, storage exception ve clipboard rejection state machine'i çökertecek exception olarak dışarı yayılmaz.

## PWA invariant

Feature asset'leri shell listesinde bulunur; cache version güncel değilse release testinde yakalanır.
