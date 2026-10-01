# Uyumluluk Matrisi

| Yetkinlik | Temel davranış | Eksik olduğunda |
|---|---|---|
| localStorage | inventory + clear | panel unavailable |
| TextEncoder | byte hesabı | modern browser hedefi |
| navigator.storage | quota/usage | em dash göster |
| Clipboard API | summary/report copy | hata mesajı |
| Blob/URL | report download | hata mesajı |
| Optional chaining | feature code | desteklenen Node/browser |

Privacy center progressive enhancement kullanır. Opsiyonel bir browser API yokluğu veri temizleme kapsamını genişletmemelidir.

Service Worker asset cache davranışı core feature değildir; fakat PWA release gate'inin parçasıdır.
