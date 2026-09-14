# Smart Fill Operasyon Runbook'u

## Yayın

1. Branch diff'i base→head olarak ölç.
2. 3000 değişen satır limitini doğrula.
3. Source/security/a11y/PWA testlerini çalıştır.
4. PR gövdesine test durumunu yaz.
5. PR merge edilmeden önce mergeable durumunu yeniden kontrol et.

## Runtime kontrolü

Prompt Library kartı açıldığında Smart Fill asset'i yüklenmiş olmalıdır. Değişkenli bir prompt seçildiğinde panel açılır. Değişkensiz prompt normal `Kullan` davranışını sürdürür.

Command palette için composer'a `/prompt` yazılır veya `Ctrl/⌘+Shift+O` kullanılır.

## Storage kontrolü

`hafize.prompt-library.v1` istem kayıtlarının ana kaynağıdır. Smart Fill presetleri `hafize.prompt-library.smart-fill.v1.<promptId>` altında tutulur. Presetler export/import kapsamı dışındadır.

## Sorun giderme

Panel görünmüyorsa browser cache ve service worker güncelliği kontrol edilir; cache sürümü v28 olmalıdır.

Panel açılıp veri gelmiyorsa localStorage JSON'u bozulmuş olabilir. Smart Fill bozuk veride boş listeye döner.

Mesaja aktarım çalışmıyorsa `#messageInput` elemanının mevcut olduğu ve event dispatch zincirinin bozulmadığı kontrol edilir.

Palette çalışmıyorsa command palette asset'inin HTML'de bulunması ve `PromptLibraryCommandPalette` globalinin yüklenmesi kontrol edilir.

## Geri alma

Smart Fill CSS/JS ve command palette asset'lerini taşıyan commitler revert edilebilir. Prompt Library temel kayıtları ve usage verileri aynı kalır.

Preset temizliği ayrıca yapılacaksa `hafize.prompt-library.smart-fill.v1.` ile başlayan anahtarlar kullanıcı onayıyla kaldırılmalıdır.

## Gözlemlenebilirlik

Server loglarına prompt veya değişken değeri yazılmaz. Smart Fill özel analytics olayı üretmez. Hata durumları yalnız kullanıcı arayüzünde kısa mesajla gösterilir.

## Kabul ölçütleri

- API çağrısı yok.
- Otomatik gönderim yok.
- En fazla 12 değişken.
- Değer başına 1000 karakter.
- Prompt başına 6 preset.
- Palette 12 sonuç.
- Escape/Tab/Enter akışı çalışır.
