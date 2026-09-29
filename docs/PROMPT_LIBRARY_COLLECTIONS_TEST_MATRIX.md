# Koleksiyon Test Matrisi

| Alan | Test | Beklenen |
|---|---|---|
| Normalize | boş isim | null |
| Normalize | uzun isim | 36 karakter |
| Normalize | duplicate ID | tek kayıt |
| Map | geçersiz collection ID | prune |
| Map | geçersiz prompt ID | prune |
| Count | atanmış prompt | doğru sayı |
| Count | atanmamış prompt | sıfır |
| Assign | geçerli collection | ilişki yazılır |
| Assign | none | ilişki kaldırılır |
| Bulk | 0 seçim | işlem yok |
| Bulk | geçerli seçim | tüm ilişkiler güncellenir |
| Delete | collection | prompt korunur |
| Filter | all | tüm satırlar görünür |
| Filter | none | yalnız atanmamışlar görünür |
| Filter | collection | yalnız ilgili satırlar görünür |
| Import | bozuk JSON | veri korunur |
| Import | duplicate name | mevcut ID |
| Import | duplicate ID | yeni ID |
| Export | bounded payload | <= 500 KB |
| Security | HTML isim | textContent |
| Security | network | fetch yok |
| A11y | labels | mevcut |
| A11y | roles | mevcut |
| Keyboard | Ctrl+Shift+O | filtre odaklanır |
| PWA | assets | shell listesinde |
| Lifecycle | destroy | observer/listeners temiz |
