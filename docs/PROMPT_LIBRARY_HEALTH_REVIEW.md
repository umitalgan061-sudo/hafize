# Health Center Kod İnceleme Kontrolü

## Mimari

- Panel Prompt Library kartına bağımsız olarak mount edilir.
- Prompt, collection ve revision storage anahtarları değiştirilmez.
- Health state ayrı namespace kullanır.
- PWA shell asset listesi günceldir.

## Veri bütünlüğü

- Prompt root biçimi kontrol edilir.
- Bozuk kayıtlar raporlanır.
- Duplicate id açıkça error olarak gösterilir.
- Collection ve revision ilişkileri prompt id kümesiyle kontrol edilir.

## Kalite sinyalleri

- Etiket eksikliği warning'dir.
- Uzun gövde warning'dir.
- Sıfır kullanım info'dur.
- Eski kayıt info'dur.
- Yakın duplicate info'dur.

## Güvenlik

- Network çağrısı yoktur.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML` kullanılmaz.
- Kullanıcı metni textContent ile yazılır.
- Export kullanıcı eylemine bağlıdır.
- Download URL'leri iş bitiminde revoke edilir.
- Onarım confirmation sonrası çalışır.

## Performans

- Veri listeleri bounded'dir.
- Similarity karşılaştırması sınırlıdır.
- Görsel issue listesi 80 kayıtla bounded'dir.
- Export bounded boyuttadır.

## Erişilebilirlik

- Başlık ilişkisi vardır.
- Status ve list semantiği vardır.
- Native controls kullanılır.
- Focus-visible görünürdür.
- Forced-colors desteklenir.
- Mobil breakpoint tanımlıdır.

## Regression

- Index script sırası kontrol edilir.
- Service worker cache sürümü yükseltilir.
- API yollarının network-only politikası korunur.
- Health enhancement core'dan sonra yüklenir.

## Onay

Kod review tamamlandıktan sonra PR diff'i tekrar ölçülmeli ve 3000+ anlamlı değişiklik şartı doğrulanmalıdır.
