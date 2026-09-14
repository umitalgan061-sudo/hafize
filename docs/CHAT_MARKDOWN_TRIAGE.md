# Chat Markdown Triage Matrisi

| Belirti | İlk kontrol | İkinci kontrol |
| --- | --- | --- |
| Düz metin | index asset referansları | observer kurulumu |
| Kod kopyalama yok | Clipboard API | copy button event delegation |
| Zararlı link | safeLinkHref | URL regression corpus |
| HTML çalışıyor | DOM sink search | hostile corpus |
| Yavaş streaming | inline limit | observer batching |
| Geniş tablo | table wrapper | mobile CSS |
| PWA asset yok | shell listesi | cache revision |
| Eski sohbet bozuk | raw content | ownership regression |

## Destek ilkesi

Önce production davranışını değiştirmeden source-contract testleri çalıştırılır. Güvenlik şüphesinde feature kapatılır; syntax genişletmek yerine mevcut allowlist ve bounded sınırlar korunur.
