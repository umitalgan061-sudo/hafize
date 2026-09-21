# Composer Ekleri — QA

## Pozitif senaryolar
| Senaryo | Beklenen |
| --- | --- |
| txt seç | kabul |
| js seç | javascript dili |
| çoklu seçim | en fazla 4 |
| preview | en fazla 12 satır |
| range | en fazla 400 satır |
| checkbox kapalı | insert kapsamı dışında |
| insert | fenced text composer'a eklenir |
| normal gönder | ayrı kullanıcı eylemi |
| drag drop | files okunur |
| clipboard file | dosya eklenir |
| normal text paste | text paste korunur |
| Escape | panel kapanır |
| Ctrl/Shift/A | panel toggle |

## Negatif senaryolar
| Senaryo | Beklenen |
| --- | --- |
| bilinmeyen uzantı | okunmadan red |
| boş file | red |
| >256 KB | okunmadan red |
| binary control yoğunluğu | red |
| >4 file | sınırda kesilir |
| >200k total | yeni kayıt red |
| payload > composer | textarea değişmez |
| invalid range | clamp |

## Regression
Submit handler'ına attachment kodundan doğrudan çağrı gelmemelidir.

Prompt Library, Composer History veya schedule storage alanlarına attachment yazımı olmamalıdır.

PWA shell listesinde üç attachment asset'i bulunmalıdır.

## Manuel release
1. Paneli aç.
2. JS dosyası ekle.
3. Preview aç.
4. Range'i değiştir.
5. Checkbox'u kapatıp aç.
6. Mesaja ekle.
7. Composer metnini kontrol et.
8. Gönder düğmesine kullanıcı basmadan request oluşmadığını doğrula.