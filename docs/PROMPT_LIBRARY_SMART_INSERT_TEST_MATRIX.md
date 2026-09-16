# Smart Insert — Test Matrisi

| Alan | Kontrol | Beklenen |
|---|---|---|
| Syntax | public Smart Insert JS | Hatasız parse |
| Syntax | history bridge | Hatasız parse |
| Syntax | profile center | Hatasız parse |
| Syntax | presets | Hatasız parse |
| Syntax | validation | Hatasız parse |
| Bounds | profile count | 24 |
| Bounds | variable count | 12 |
| Bounds | variable name | 32 |
| Bounds | variable value | 1000 |
| Bounds | history count | 40 |
| Bounds | import bytes | 300 KB |
| Security | innerHTML | Yok |
| Security | outerHTML | Yok |
| Security | network API | Yok |
| Security | prompt body in history | Yok |
| Security | variable value in history | Yok |
| DOM | role dialog | Var |
| DOM | aria-modal | true |
| DOM | aria-labelledby | Var |
| DOM | role list/listitem | Var |
| DOM | textContent | Kullanılıyor |
| UX | missing variable | Hata + ilk alan focus |
| UX | preview | Canlı güncelleme |
| UX | reset | Alanları temizler |
| UX | escape | Dialog kapanır |
| UX | tab | Focus trap |
| UX | ctrl/cmd-enter | Aktarım |
| UX | auto submit | Yok |
| Profile | create | Yeni bounded kayıt |
| Profile | rename | Duplicate reddedilir |
| Profile | favorite | Güncellenir |
| Profile | duplicate | Yeni ID |
| Profile | delete | Onay gerekir |
| Profile | import | Normalize + merge |
| Profile | export | JSON |
| History | record | ID + label + time |
| History | repeat | Tekilleştirme |
| History | remove | Sadece history |
| History | clear | Onay + boş history |
| Suggestions | scoring | Ortak variable isimleri |
| Suggestions | max | 5 |
| Preset | upsert | Name unique |
| Preset | import | 300 KB |
| Preset | export | Versioned JSON |
| Shortcut | Shift+I | Smart Insert |
| Shortcut | Shift+L | Profile Center |
| Shortcut | Shift+H | History |
| Shortcut | typing guard | Çalışmaz |
| PWA | JS asset | Shell cache |
| PWA | CSS asset | Shell cache |
| PWA | version | v38 |
| PWA | API | Network-only |
| Mobile | 700px | Tek kolon |
| Accessibility | forced colors | Sistem renkleri |
| Accessibility | reduced motion | Animasyonsuz scroll |

## DoD

Bir sürüm ancak ana Smart Insert akışı, profil, history, suggestion, preset ve validation yüzeylerinin source contract testleri geçtikten sonra yayınlanır. Her yeni storage anahtarı ayrı limit ve rollback davranışı ile belgelenir.

## Negatif testler

Bozuk JSON, aşırı büyük string, null obje, duplicate ID, duplicate isim, boş isim, boş variable, geçersiz variable name, eksik composer, iptal edilen silme, storage write hatası, eksik browser API ve offline shell senaryoları ayrıca ele alınır.

## Regression

Mevcut Prompt Library kayıtları, usage insights ve collections/revisions modülleri Smart Insert tarafından overwrite edilmemelidir. Yeni modüller kendi sabit ID ve storage anahtarları dışına yazmamalıdır.
