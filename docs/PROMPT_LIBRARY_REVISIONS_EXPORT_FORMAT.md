# Revision Export Format

## Root

Export JSON kökü `version`, `source`, `promptId`, `exportedAt` ve `revisions` alanlarını içerir.

## Revision

Her revision `id`, `promptId`, `savedAt`, `reason`, `title`, `body` ve `tags` alanlarına sahiptir.

## Omissions

`favorite`, `useCount` ve `createdAt` export revision nesnesinde bulunmaz. Bu değerler ana prompt durumuna aittir.

## Sorting

Revision listesi en yeni `savedAt` önce gelecek şekilde export edilir.

## Bounds

Export 1 MB'ı aşarsa en yeni 5 revision ile bounded fallback üretilir.

## Encoding

UTF-8 JSON kullanılır. HTML veya script yorumlaması yapılmaz.

## Download

Dosya adı `hafize-prompt-revisions.json` sabittir. Prompt title gibi kullanıcı verileri dosya adına sokulmaz.

## Import separation

Bu export doğrudan ana Prompt Library import alanına verilmez. Revision formatı ayrı bir storage sözleşmesidir.

## Privacy

Export istem metinlerini içerir; kullanıcı dosyayı paylaşmadan önce hassas verileri gözden geçirmelidir.
