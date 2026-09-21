# Composer Ekleri — Payload Format

## Genel
Attachment payload, kullanıcı mesajının sonuna veya textarea selection yerine fenced code block olarak eklenir.

## Şablon
[Dosya: dosya-adı · satır başlangıç-bitiş]
fence + language
content
fence

## Fence collision
İçerikte üç backtick varsa dört backtick kullanılır. Amaç markdown kapanış çakışmasını önlemektir.

## Language
Language etiketi yalnız uzantıdan türetilir. Bu etiket dosyayı çalıştırmaz.

## Range
Start ve end değerleri 1 tabanlıdır. Aralık en fazla 400 satırdır.

## Atomicity
Payload boyutu önceden hesaplanır. Composer kapasitesi yetmiyorsa hiçbir bölüm yazılmaz.

## Cursor
Textarea selectionStart ve selectionEnd kullanılır. Seçili text varsa replace, seçim yoksa insertion yapılır.

## Undo
Son insert öncesindeki before/after parçaları in-memory snapshot olarak tutulur. Metin arada dışarıdan değişmişse restore reddedilebilir.

## Copy
Copy eylemi fenced payload değil seçilen ham range metnini clipboard'a yazar.