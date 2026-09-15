# Revision Data Model

## Ana anahtar

`hafize.prompt-library.revisions.v1` bir JSON object olarak saklanır. Object anahtarları prompt id, değerleri revision listeleridir.

```json
{
  "prompt-id": [
    {
      "id": "revision-id",
      "promptId": "prompt-id",
      "savedAt": "2026-09-15T09:00:00.000Z",
      "reason": "before-edit",
      "title": "Başlık",
      "body": "İstem metni",
      "tags": ["kod"]
    }
  ]
}
```

## Kimlikler

`promptId`, ana Prompt Library kaydındaki id ile birebir eşleşir. Revision id bağımsızdır. Revision id çakışması beklenmez; yeni snapshot rastgele UUID üretir.

## Zaman

`ISO 8601` string kullanılır. Sıralama en yeni snapshot önce olacak şekilde yapılır.

## Reason

`before-edit`, kullanıcı istemi düzenlemeye başlamadan önce otomatik alınan snapshot anlamına gelir. `manual`, geri yükleme öncesindeki mevcut durum için alınan kurtarma snapshot'ıdır.

## İçerik alanları

Başlık 100 karakter, body 8000 karakter, etiket sayısı 8, tek etiket uzunluğu 24 karakter ile sınırlıdır. Boş body geçerli revision değildir.

## Taşınmayan alanlar

Favori, kullanım sayısı ve `createdAt` revision verisine yazılmaz. Bu ayrım kullanım istatistiklerinin eski sürüm geri yüklenirken bozulmasını engeller.

## Normalizasyon

Storage dışından gelen bozuk object, array, uzun text, null byte ve yanlış reason değerleri normalize edilir. Prompt id ile kayıt anahtarı eşleşmiyorsa revision atılır.

## Retention

Prompt başına son 10 revision korunur. Storage en fazla 120 prompt anahtarı işler. Üst sınır aşıldığında eski veriler yeni snapshot'lar için kaydırılır.
