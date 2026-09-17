# Health Center Release Checklist

## Kod

- Health core mevcut Prompt Library normalizer'ını kullanıyor.
- Health enhancement yalnızca yerel export yüzeyleri ekliyor.
- UI native button/select/section öğeleriyle oluşturuluyor.

## Entegrasyon

- `prompt-library-health.css` index.html içinde yükleniyor.
- `prompt-library-health.js` Prompt Library modüllerinden sonra yükleniyor.
- Enhancement ana health modülünden sonra yükleniyor.
- Service worker shell cache yeni CSS/JS dosyalarını içeriyor.

## Veri

- Prompt storage anahtarı değişmiyor.
- Collection storage anahtarı değişmiyor.
- Revision storage anahtarı değişmiyor.
- Health state bağımsız tutuluyor.

## Güvenlik

- Yeni secret eklenmiyor.
- Network endpoint eklenmiyor.
- Export kullanıcı etkileşimi olmadan başlamıyor.
- Repair confirmation gerektiriyor.

## UX

- Sağlıklı durumda anlaşılır durum metni var.
- Severity filtresi çalışmalı.
- Mobil ve forced-colors stilleri bulunmalı.

## DoD

Tüm health test scriptleri syntax kontrolünden geçmeli.

Kaynak sözleşme testleri başarısızsa PR merge edilmemeli.

Manuel browser kontrolünde panel görünür, kullanılabilir ve composer akışını bozmaz olmalı.

## Rollback

Health asset ve dokümanları revert etmek yeterlidir. Ana Prompt Library verisi ayrı bir süreçle yönetilir.
