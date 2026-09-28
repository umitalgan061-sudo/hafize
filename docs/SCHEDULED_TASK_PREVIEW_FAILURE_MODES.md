# Preview Hata Modları

| Hata | Davranış |
| --- | --- |
| Ajan seçilmemiş | Preview açılır, onay pasif kalır |
| Görev boş | Preview açılır, hata görünür |
| Geçmiş zaman | Preview açılır, hata görünür |
| Form kaldırılmış | Preview mevcut form üzerinden yeni submit kabul etmez |
| Dialog kapandı | Form değerleri değişmeden korunur |
| requestSubmit desteklenmiyor | Fallback submit olayı denenir |
| Clipboard kullanılamıyor | Kopyalama hatası gösterilir |
| Mutation sonrası yeni form | Observer yeniden bağlanır |
| Sayfa kapanıyor | Observer, timer ve listener temizlenir |
| PWA eski cache | Cache version yenilenerek shell güncellenir |
| Duplicate çalışma durumu | Çalışıyor görevlerde tekrar düğmesi gösterilmez |
