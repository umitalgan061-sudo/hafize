# Markdown release kontrol listesi

## Kod

- [ ] Renderer yalnız izin verilen DOM elementlerini üretir.
- [ ] URL allowlist korunur.
- [ ] Input, block ve line sınırları korunur.
- [ ] Kod blokları çalıştırılmaz.
- [ ] Clipboard ve download kullanıcı eylemiyle başlar.
- [ ] Observer yaşam döngüsü sınırlıdır.

## UX

- [ ] Assistant yanıtı okunabilir biçimlendirme alır.
- [ ] Uzun kod blokları daraltılabilir.
- [ ] Uzun yanıtlar daraltılabilir.
- [ ] Başlık özeti yalnız en az iki başlıkta görünür.
- [ ] Alıntılama composer limitine uyar.
- [ ] Ham metin görünümü geri döndürülebilir.

## PWA

- [ ] Markdown CSS shell cache'tedir.
- [ ] Renderer JS shell cache'tedir.
- [ ] Enhancement JS shell cache'tedir.
- [ ] Code tools CSS/JS shell cache'tedir.
- [ ] Message action CSS/JS shell cache'tedir.
- [ ] Outline CSS/JS shell cache'tedir.
- [ ] Cache version değişmiştir.

## Security

- [ ] `innerHTML` yoktur.
- [ ] `outerHTML` yoktur.
- [ ] `insertAdjacentHTML` yoktur.
- [ ] `document.write` yoktur.
- [ ] `eval`/`Function` yoktur.
- [ ] Yeni network endpoint yoktur.

## Tests

Source, formatting, links, security, DOM boundary, limits, streaming, tools, accessibility, PWA ve message actions testleri çalıştırılmalıdır.

Tam `npm run check` mümkün değilse PR açıklamasında açıkça belirtilmelidir.

## Rollout

Önce canary ortamında kısa ve uzun assistant yanıtları test edilir.

Ardından tablo, task list, code fence ve harici link örnekleri kontrol edilir.

## Revert

Renderer ile ilgili dosyaları tek tek silmek yerine PR revert tercih edilir.

Ham sohbet storage'ı korunur.
