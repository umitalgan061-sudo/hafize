# Composer History — Veri Modeli

## History

Ana kayıt modeli JSON array'dir.

```json
[
  "Bugünkü işleri planla",
  "Bu kodu incele"
]
```

Her eleman string olmak zorundadır.

Boş veya yalnız whitespace kayıtlar yüklenmez.

Null byte karakterleri normalize edilir.

Her değer en fazla 12.000 karakterdir.

Array en fazla 40 kayıt taşır.

Yeni submit ilk sıraya eklenir.

Aynı metin mevcutsa eski örnek kaldırılır ve yeni örnek ilk sıraya alınır.

## Settings

```json
{
  "enabled": true,
  "maxItems": 40
}
```

`enabled` yalnız boolean olarak yorumlanır.

Başka tipler güvenli varsayılanlara düşer.

`maxItems` yalnız 0, 10, 20 veya 40 değerlerinden biri olabilir.

0, kalıcı history kaydını kapatır.

## Sürümleme

History key `hafize.composer-history.v1` olarak sabittir.

Ayar key `hafize.composer-history.settings.v1` olarak ayrıdır.

İleride v2 gerekirse v1 okunabilirliği explicit migration ile yapılmalıdır.

Mevcut v1 kaydı sessizce başka semantiğe dönüştürülmez.

## Bounded davranış

Storage'dan okunan array önce tip açısından filtrelenir.

Sonra karakter ve kayıt sınırları uygulanır.

Storage içeriği güvenilir kabul edilmez.

History paneli yalnız controller tarafından expose edilen kayıtları görür.

## Yedekleme

Export wrapper version 1 taşır.

Import array veya `{ items }` payload kabul eder.

Unknown metadata güvenle yok sayılır.

Import sırasında kayıtlar yeniden normalize edilir.

Merge mevcut ve gelen history arasında first-wins deduplication kullanır.
