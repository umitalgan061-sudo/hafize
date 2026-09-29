# Koleksiyon Hızlı Başvuru

Storage:
- collections: `hafize.prompt-library.collections.v1`
- assignments: `hafize.prompt-library.collections.map.v1`
- default: `hafize.prompt-library.collections.default.v1`

Limitler:
- 24 koleksiyon
- 36 karakter isim
- 40 toplu seçim
- 500 KB collection import

Ana kontroller:
- Tüm koleksiyonlar
- Koleksiyonsuz
- Seçilenleri ata
- Varsayılan koleksiyon
- Yönet
- Yedeği dışa aktar
- Yedeği içe aktar

Atama davranışı:
- Tekli selector anında yazar.
- Toplu seçim tek işlemde yazar.
- NONE atamayı kaldırır.
- Collection silme prompt silmez.

Default davranışı:
- Sadece yeni prompt ID'lerinde uygulanır.
- Mevcut prompt'lar taşınmaz.
- Collection silinirse NONE olur.

Güvenlik:
- Dynamic text -> textContent
- Import -> bounded FileReader
- Export -> object URL + revoke
- Network -> yok

Klavye:
- Ctrl/Meta+Shift+O -> collection filter

Rollback:
- Collection module kaldırılabilir.
- Prompt storage korunur.
