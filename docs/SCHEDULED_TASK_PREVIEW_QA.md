# Zamanlanmış Görev Önizlemesi QA

## Kabul kriterleri

| Alan | Beklenen davranış |
| --- | --- |
| İlk submit | API POST'u çalıştırmadan dialog açılır |
| Boş görev | Onay pasif, hata görünür |
| Geçmiş zaman | Onay pasif |
| Ajan | Seçili etiket ve değer özetlenir |
| Deneme | 1–5 değeri görünür |
| Düzenle | Preview kapanır, form değerleri korunur |
| Onay | Mevcut workspace submit handler'ı bir kez çalışır |
| Escape | Dialog kapanır |
| Ctrl/⌘+Enter | Onay başlar |
| Tab | Odak dialog dışına taşmaz |
| Mobil | Modal kullanılabilir |
| Forced colors | Sınır ve odak görünür |
| Reduced motion | Gereksiz hareket yok |

## Doğrulama

Syntax kontrolü preview JS dosyasını kapsar. Preview testi event sırasını, network izolasyonunu ve erişilebilirlik sözleşmesini kontrol eder. Ardından mevcut scheduled-tasks testleri çalıştırılır.

## Özellikle izlenecek regresyon

Preview capture fazında çalışır. Onaydan sonra bypass yalnız tek submit için kullanılır. Bu iki kontrol birlikte iki kez POST gönderilmesini önleyen temel mekanizmadır.

MutationObserver görev paneli yeniden yaratılırsa preview listenerını yeni forma bağlar. Dialog kapanması form değerlerini değiştirmez.
