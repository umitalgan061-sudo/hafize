# Prompt Import Format Contract

## Desteklenen kökler

Import iki biçimi kabul eder:

```json
[
  {"id":"...","title":"...","body":"..."}
]
```

ve:

```json
{
  "version": 1,
  "source": "hafize-prompt-library",
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "items": []
}
```

## Item alanları

`body` zorunludur. `title`, `tags`, `variables`, `favorite`, `useCount`, `createdAt` ve `updatedAt` normalize edilir. Tanınmayan alanlar saklanmaz.

## Sınırlar

Body 8000 karaktere, başlık 100 karaktere, tag sayısı 8'e, tek tag 24 karaktere ve değişken sayısı 12'ye sınırlandırılır. Import dosyası 1 MB'ı aşamaz. Kütüphane toplam 120 kayıt tutar.

## Çakışma

Aynı id ile gelen kayıt mevcut kaydı overwrite etmez. Merge işlemi yeni rastgele id üretir. Aynı import içindeki duplicate id'ler de ayrı kimliklere çevrilir.

## Geçersiz kayıtlar

Body boşsa kayıt atılır. JSON kökü beklenen türlerden biri değilse import preview hata gösterir. Tek bir hatalı item bütün geçerli kayıtların preview'da görünmesini engellemez; normalizer geçersiz item'ı dışarıda bırakır.

## Metadata

`source` ve `exportedAt` yalnız preview açıklamasında yardımcı metadata olarak kullanılabilir; prompt item içine kopyalanmaz.

## Compatibility

Mevcut export dosyası yeniden import edilebilir. Yeni preview katmanı temel `normalizeImportedPayload` ve `mergeImportedItems` sözleşmesini kullanır.

## Privacy

Dosya tarayıcıda okunur. İçeriği backend'e gönderilmez. Import işlemi yalnız açık kullanıcı onayından sonra local storage'a yazılır.
