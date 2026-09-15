# Yerel Veri Merkezi — Test Matrisi

| Alan | Kontrol |
|---|---|
| Registry | 8 beklenen storage descriptor'ı bulunur |
| Allowlist | Bilinmeyen key clear edilemez |
| Parse | Bozuk JSON diğer alanları bozmaz |
| Bounds | 1.5 MB okuma sınırı uygulanır |
| Size | UTF-8 byte değeri hesaplanır |
| Count | Array/object değerleri güvenli özetlenir |
| Clear | Tekil silme yalnız hedef key'i etkiler |
| Clear-all | Yalnız allowlist silinir |
| Confirmation | İptal mutation oluşturmaz |
| Manifest | Metadata-only payload üretilir |
| DOM | Dynamic text HTML olarak yorumlanmaz |
| A11y | Role, label, live region ve focus kontrol edilir |
| Cross-tab | Known storage event refresh üretir |
| Lifecycle | Destroy listener'ları kaldırır |
| PWA | CSS/JS shell listesinde bulunur |
| API | `/api/*` network-only davranışı korunur |
| Mobile | Dar ekranda action stack bozulmaz |
| Security | Cookie/network/telemetry yoktur |
| Failure | Storage exception fail-soft olur |
| Rollback | Revert storage'ı otomatik silmez |
