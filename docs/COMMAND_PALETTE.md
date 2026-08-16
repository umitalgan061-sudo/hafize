# Hafize komut paleti

`public/command-palette.js`, Claude-benzeri masaüstü verimliliği için yalnız yerel ve görünür UI aksiyonlarını tek arama yüzeyinde toplar.

## Açma

- Windows/Linux: `Ctrl + Shift + P`
- macOS: `Cmd + Shift + P`
- `Escape`: paleti kapatır.
- `ArrowUp` / `ArrowDown`: görünür sonuçlar arasında dolaşır.
- `Enter`: seçili komutu açık kullanıcı eylemi olarak çalıştırır.

## Allowlist

Palet komutları kod içinde immutable `COMMANDS` listesiyle sınırlıdır. İlk sürüm yalnız şu işlemleri içerir:

- mesaj alanına odaklanma,
- yeni sohbet düğmesini tıklama,
- tema düğmesini tıklama,
- yan menü düğmesini tıklama,
- mevcut mikrofon düğmesini tıklama,
- son mesaja kaydırma.

Model çıktısı, sohbet metni, query string veya connector sonucu yeni komut üretemez.

## Bilerek dışarıda bırakılanlar

- Mesajı otomatik gönderme.
- Tool mode açma veya tool çağrısı üretme.
- Sohbet geçmişini temizleme/silme.
- OAuth/connector yazma-gönderme işlemleri.
- GitHub branch/PR/merge işlemleri.
- Secret veya credential erişimi.
- Harici URL açma.

Bu nedenle palet backend permission modelini bypass eden ikinci bir tool sistemi değildir.

## Erişilebilirlik ve lifecycle

Palet `role=dialog`, `aria-modal=true`, arama alanı ve `listbox/option` semantiği kullanır. Açıldığında mevcut odağı hatırlar; komut çalıştırmadan kapatılırsa odağı önceki elemana döndürür. Komut başarıyla çalışırsa hedef kontrol kendi doğal fokus/etkileşim davranışını sürdürür.

Stiller modül içinde sabit metin olarak bir kez enjekte edilir. `destroy()` çağrısı klavye listener'ını ve dinamik dialog DOM'unu kaldırır.

## PWA

`command-palette.js`, enhancement loader allowlist'ine ve service-worker shell cache'e birlikte eklenir. Cache sürümü `v50` olur. `/api/*` network-only davranışı değişmez.
