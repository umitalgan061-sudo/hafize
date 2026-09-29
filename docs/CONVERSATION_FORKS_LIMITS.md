# Konuşma Dalları Limitleri

| Alan | Limit | Amaç |
|---|---:|---|
| Conversation | 30 | localStorage büyümesini sınırlar |
| Message | 100 | fork kopyasını bounded tutar |
| Message content | 12000 | tek mesaj boyutunu sınırlar |
| Direct child | 8 | branch panelini kontrol altında tutar |
| Depth | 4 | parent traversal maliyetini sınırlar |
| Title | 80 | UI taşmasını önler |
| Fork note | 400 | metadata büyümesini sınırlar |
| Preview | 180 | dialog içeriğini kısa tutar |

Limitler kullanıcı içeriğini silmek için değil, fork işleminin öngörülebilir ve güvenli kalması için uygulanır.
