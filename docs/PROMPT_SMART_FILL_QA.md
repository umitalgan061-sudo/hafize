# Smart Fill QA Matrisi

## Fonksiyonel

| Senaryo | Beklenen |
|---|---|
| Değişkensiz `Kullan` | Eski doğrudan aktarım |
| Tek değişken | Panel açılır |
| Birden çok değişken | Her biri ayrı alana gelir |
| Değer değişimi | Önizleme anında güncellenir |
| Boş değer | Aktarım engellenir |
| Set kaydetme | Yerel preset oluşur |
| Set seçme | Değerler alanlara yüklenir |
| Set temizleme | Yalnız seçili prompt setleri silinir |
| Önizleme kopyalama | Clipboard'a yalnız çıktı gider |
| Mesaja aktar | Composer dolar, submit olmaz |
| `/prompt` | Palette görünür |
| `/prompt arama` | Sonuçlar filtrelenir |
| Palette Enter | Seçim yapılır |
| Palette Escape | Panel kapanır |
| Ctrl/⌘+Shift+O | Palette açılır |

## Güvenlik

Kötü niyetli HTML, uzun değer, bozuk preset JSON, sahte storage nesnesi ve olmayan clipboard senaryoları kontrol edilir.

## Erişilebilirlik

Dialog role, listbox role, option selection state, aria-live, labelled inputs, focus return ve focus trap doğrulanır.

## PWA

Her yeni CSS/JS asset'inin shell listesinde bulunması ve cache versiyonunun artması kontrol edilir.

## Regresyon

Prompt Library normal CRUD akışı, favori, filtre, import/export, starter seed ve usage insight davranışları değişmeden kalmalıdır.

## Test sınıfları

- source contract,
- security contract,
- data-shape contract,
- lifecycle contract,
- keyboard contract,
- DOM boundary contract,
- PWA wiring,
- command ranking,
- release regression.

## Bilinen sınır

Tam browser E2E ve gerçek ekran okuyucu kombinasyon matrisi bu değişiklikte koşulmadı. Kaynak seviyesindeki garantiler release öncesi ilk savunma katmanıdır.
