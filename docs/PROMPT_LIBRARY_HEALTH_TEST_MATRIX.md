# Health Center Test Matrisi

| Alan | Durum | Beklenen |
|---|---|---|
| Empty storage | boş | Sağlıklı başlangıç |
| Valid prompts | geçerli | Doğru prompt sayısı |
| Root shape | bozuk | Error |
| Record shape | bozuk | Error |
| Duplicate id | tekrar | Error |
| Duplicate title | tekrar | Warning |
| Duplicate body | tekrar | Warning |
| Near duplicate | benzer | Info |
| Missing tags | eksik | Warning |
| Long body | 7000+ | Warning |
| Use count | 0 | Info |
| Bad use count | negatif/non-number | Warning |
| Stale prompt | 180+ gün | Info |
| Variable overflow | 12+ | Error |
| Collection orphan | kayıp prompt | Warning |
| Collection duplicate id | tekrar | Error |
| Empty collection | sıfır üye | Info |
| Revision orphan | kayıp prompt | Warning |
| Revision malformed | bozuk | Error |
| Repair cancel | iptal | Storage değişmez |
| Repair confirm | onay | Normalize edilir |
| Export report | kullanıcı | JSON dosyası |
| Export problems | kullanıcı | Problemli prompt JSON |
| Clipboard failure | API yok | Durum mesajı |
| Storage failure | erişim yok | Güvenli hata |
| PWA asset | eksik | Test fail |
| DOM injection | kötü metin | HTML çalışmaz |
| Mobile | dar viewport | Taşma olmaz |
| Forced colors | sistem | Kontrast korunur |
| Lifecycle | tekrar mount | Duplicate panel yok |
