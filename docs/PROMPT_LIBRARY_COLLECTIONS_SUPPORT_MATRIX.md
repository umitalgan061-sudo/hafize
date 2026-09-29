# Koleksiyon Destek Matrisi

| Konu | Kullanıcı belirtisi | İlk kontrol |
|---|---|---|
| Mount | Panel yok | Prompt Library kartı |
| Storage | Liste boş | localStorage JSON |
| Assignment | Seçim kalmıyor | map key |
| Filter | Prompt görünmüyor | active filter + map |
| Bulk | Atama yok | checkbox + target |
| Default | Yeni prompt taşınmıyor | default key |
| Delete | Prompt kayıp sanılıyor | collection silme semantiği |
| Import | Dosya reddi | 500 KB + JSON |
| Export | Dosya yok | object URL |
| Keyboard | O kısayolu çalışmıyor | editable hedef |
| PWA | Eski UI | service worker cache |

Support temel kuralı: collection metadata sorununda prompt body verisini değiştirmeyin.

Data repair önce export ile yedeklenmelidir.

Stale assignment normal render sırasında temizlenebilir.

Bozuk collection storage fallback ile güvenli boş state'e dönebilir.
