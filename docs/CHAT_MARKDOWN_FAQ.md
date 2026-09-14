# Chat Markdown SSS

### Kullanıcı mesajları neden biçimlenmiyor?

Çünkü Markdown yalnız asistan çıktı katmanına aittir. Kullanıcı metninin davranışını değiştirmek textarea ve geçmiş yüzeylerinde gereksiz risk yaratır.

### Neden raw HTML desteklenmiyor?

Model çıktısı güvenilmezdir. Raw HTML desteği DOM'a element, event handler ve navigation yetkisi taşımayı kolaylaştırır. Hafize bunun yerine güvenli bir Markdown alt kümesi kullanır.

### Link neden her zaman tıklanabilir değil?

Yalnız HTTP, HTTPS ve mailto şemaları allowlist'tedir. Diğer şemalar metin olarak kalır. Böylece modelin ürettiği bir metin URL'si otomatik çalıştırma yüzeyi olmaz.

### Neden Markdown parser üçüncü taraf değil?

Bu özelliğin desteklediği sözdizimi sınırlı. Küçük, denetlenebilir bir parser güvenlik sınırını açık tutar ve yeni dependency/bundle etkisi getirmez.

### Neden code syntax highlighting yok?

Kodun metin olarak güvenli çizilmesi öncelikli. Highlighting için ayrı tokenizer bağımlılığı, dil grammerları ve ek DOM üretimi gerekir. Bu turda buna ihtiyaç olmadığı için kapsam dışıdır.

### Tablolar mobilde neden yatay kayıyor?

Tek satırlı table wrapper viewport'un büyümesini engeller. Küçük ekran kullanıcıları tabloyu kendi container'ında kaydırabilir.

### Çok uzun satır neden biçimlenmiyor?

Inline parser'ın maliyeti sınırsız bırakılmaz. Uzun satır düz text olur; bilgi kaybolmaz, yalnız markup etkisi kaldırılır.

### Kod kopyalama sunucuya veri gönderiyor mu?

Hayır. Kod bloğu zaten istemcide bulunur ve kopyalama Clipboard API ile yalnız kullanıcı tıklaması sonrası gerçekleşir.

### PWA'da yeni sürüm neden cache değiştiriyor?

JS/CSS shell assetleri değiştiğinde eski byte'ların yeni HTML ile karışması istenmez. Cache revision bu yüzden artırılır.

### Message Workspace ile ilişkisi nedir?

Message Workspace mesaj metadata'sını ayrı bir localStorage anahtarında tutar. Markdown yalnız sunum katmanıdır. İki özellik birbirinin state'ini yazmaz.
