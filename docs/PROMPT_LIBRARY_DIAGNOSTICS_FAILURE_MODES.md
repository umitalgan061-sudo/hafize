# Diagnostics failure modes

| Durum | Davranış |
| --- | --- |
| Prompt storage okunamıyor | Otomatik repair yapılmaz |
| Duplicate ID | Raporlanır, güvenli repair yeni ID üretir |
| Bozuk item | Raporlanır, yalnızca normalize edilebilir kayıtlar repair'e girer |
| Orphan collection | Geçerli prompt ID'leri kalır |
| Orphan revision | Geçerli prompt ID'leri kalır |
| Çok fazla orphan | MAX_ORPHANS koruması |
| Backup fazla büyük | İndirme oluşturulmaz |

Diagnostics hiçbir hatayı sessizce “başarılı” olarak işaretlememelidir.
