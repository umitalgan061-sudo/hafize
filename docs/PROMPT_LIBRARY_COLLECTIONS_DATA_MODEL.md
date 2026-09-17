# Collections data model

## Storage key

`hafize.prompt-library.collections.v1`

Değer JSON array'dir. JSON parse edilemezse boş array kabul edilir.

## Collection

```text
id: string
name: string
description: string
color: string
promptIds: string[]
createdAt: ISO-like string
updatedAt: ISO-like string
```

## Identity

`id` yalnızca koleksiyon kimliğidir. Prompt identity mevcut `hafize.prompt-library.v1` içindeki `id` alanında kalır.

## Membership

`promptIds` yalnızca var olan prompt id'lerinden oluşur. Yazma işlemi id tipini string ile sınırlar, duplicate üyeleri tekilleştirir ve 120 üyede keser.

## Normalization

Input obje değilse reddedilir. Boş isimli koleksiyon reddedilir. Name ve description trim + length bound uygulanarak normalize edilir. Unknown fields korunmaz.

## Bounds

40 collection, collection başına 120 member, 80 karakter name, 240 karakter description, 100 karakter query. JSON import 500 KB ile sınırlandırılır.

## Atomicity

Storage yazımı başarısız olursa çağrı false/null ile failure-safe döner. Başarısız update mevcut kaydı değiştirmemelidir.

## Orphan cleanup

`pruneMembers` geçerli prompt id kümesini prompt storage'dan çıkarır ve üyelikleri buna göre küçültür. Prompt storage okunamazsa güvenli boş küme sonucu yalnızca explicit çağrıda kullanılmalıdır; UI katmanı storage failure durumunu sessiz veri kaybı gibi sunmamalıdır.

## Import

Import yeni koleksiyon id'leri üretir. Aynı ada sahip mevcut koleksiyon tekrar eklenmez. Member id'leri mevcut prompt storage'a göre prune edilir.

## Export

Export sürüm 1 envelope kullanır ve yalnızca normalize edilmiş collections dizisini taşır. Prompt body'leri collection export içine kopyalanmaz.

## Migration

v1 dışında bir koleksiyon schema'sı desteklenmez. Yeni schema gerekirse yeni storage key kullanılmalı veya explicit migration fonksiyonu eklenmelidir.

## Compatibility

Mevcut prompt item JSON formatı değişmez. Collections yalnızca referans katmanıdır ve eski Prompt Library işlemlerinden bağımsız çalışır.
