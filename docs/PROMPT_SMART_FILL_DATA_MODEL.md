# Smart Fill Veri Modeli

Smart Fill mevcut Prompt Library kayıtlarının içine yeni alan eklemez. Yalnızca ayrı local storage anahtarları kullanır.

## Prompt verisi

Ana kayıt alanı: `hafize.prompt-library.v1`.

İstem kaydında `id`, `title`, `body`, `tags`, `variables`, `favorite`, `useCount`, `createdAt` ve `updatedAt` alanları bulunabilir.

Smart Fill yalnızca `body` üzerinden değişken isimlerini çıkarır ve çekirdek `replaceVariables` fonksiyonunu kullanır. Böylece iki farklı değişken değiştirme algoritması oluşmaz.

## Preset anahtarı

Preset anahtarı biçimi:

`hafize.prompt-library.smart-fill.v1.<promptId>`

Bir preset:

```json
{
  "id": "uuid",
  "name": "Yazım kontrolü",
  "values": {
    "konu": "bir ürün duyurusu",
    "ton": "resmî"
  }
}
```

Preset içinde yalnızca değişken değerleri tutulur; istem gövdesi veya sohbet geçmişi kopyalanmaz.

## Normalizasyon

Preset listesi dizi değilse boş kabul edilir. Kayıtlar nesne değilse atılır. İsim, değişken adı ve değerler sınırlandırılır. İlk 6 preset tutulur.

Değerlerin HTML olarak yorumlanmasını önlemek için çıktı DOM'a `textContent` ile yazılır. Composer'a yazılan metin textarea'nın `value` özelliğidir.

## Sürümleme

`v1` anahtarları kullanıcı verisinin gelecekte taşınabilmesini sağlar. Yeni model gerekirse yeni bir anahtar sürümü açılır; mevcut presetler sessizce yeniden yazılmaz.

## Veri yaşam döngüsü

Panel açılırken presetler okunur. Set kaydedildiğinde atomik olmayan ancak tek anahtarlı bir `setItem` yapılır. Okuma hatasında boş listeye düşülür. Yazma hatasında kullanıcıya hata mesajı verilir.

Panel kapatıldığında geçici form verisi DOM'dan çıkarılır. Preset storage'ı kullanıcı açıkça temizlemedikçe kalır.

## Dışa aktarma

Smart Fill presetleri Prompt Library JSON export'una dahil edilmez. Böylece istem yedeği ile yerel kişisel değişken setleri ayrıştırılır.

Bu tercih aynı zamanda yanlışlıkla kişisel adres, müşteri adı veya başka bir gizli değerin prompt yedeğine taşınması riskini azaltır.
