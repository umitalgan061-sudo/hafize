# Chat Markdown Hızlı Referans

| Sözdizimi | Sonuç |
| --- | --- |
| `# Başlık` | Uygulama içi h3 başlık |
| `## Başlık` | Uygulama içi h4 başlık |
| `### Başlık` | Uygulama içi h5 başlık |
| `- madde` | Sırasız liste |
| `1. madde` | Sıralı liste |
| `- [x] madde` | Tamamlanmış görev işareti |
| `> alıntı` | Alıntı bloğu |
| `---` | Yatay çizgi |
| `` `kod` `` | Satır içi kod |
| `**kalın**` | Kalın metin |
| `*eğik*` | Eğik metin |
| `~~eski~~` | Üstü çizili metin |
| `````js ... ````` | Kod bloğu |
| `| A | B |` + ayraç | Tablo |
| `[site](https://...)` | Güvenli dış bağlantı |

## Güvenlik notu

Raw HTML, script, iframe, image embedding ve çalıştırılabilir URL şemaları desteklenmez. Tanınmayan ifadeler metin olarak kalır.

## Streaming notu

Code fence kapanmadan gelen ara cevap geçerli bir durumdur. Renderer daha sonra yeni delta geldiğinde aynı mesajı yeniden çizer.

## Mobil notu

Code ve table blokları kendi yatay kaydırma alanına sahiptir. Uzun kelimeler mesaj genişliğini taşırmaz.
