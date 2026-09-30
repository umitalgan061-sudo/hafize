# Smart Fill — Composer Sözleşmesi

## Değiştir modu

`Mesajı değiştir` seçiliyse composer içeriği yalnızca doldurulmuş istemle değiştirilir.

## Ekle modu

`Mesajın sonuna ekle` seçiliyse mevcut composer metni korunur ve araya bir boş satır eklenerek doldurulmuş istem eklenir. Sonuç mevcut 12000 karakter sınırı içinde kırpılır.

## Gönderim sınırı

Her iki mod da form submit tetiklemez. Modül yalnızca `#messageInput` değerini günceller, `input` olayı yayınlar ve textarea'ya odaklanır.

## Validation

Doldurulmamış değişken varsa aktarım durdurulur ve eksik değişkenler kullanıcıya gösterilir. Değişken değeri 1000 karakteri geçemez.

## Usage

Başarılı aktarım `useCount` değerini bir artırır ve güncellenmiş kaydı aynı local storage alanına yazar.

## Failure behavior

Composer bulunamazsa kullanıcı metni silinmez; hata panel içinde gösterilir. Kayıt başarısız olduğunda dış servise fallback yapılmaz.

## Accessibility

Dialog `role=dialog`, `aria-modal`, başlık/açıklama bağlantıları, klavye odak tuzağı ve Escape ile kapanma davranışı içerir.
