# Yerel Veri Merkezi — Gözlemlenebilirlik

Data center server telemetry üretmez. Gözlemlenebilirlik client-side snapshot, visible status ve kullanıcı tarafından indirilen metadata manifesti ile sınırlıdır.

## Metrics

Dolu alan sayısı, toplam byte, alan bazında byte ve integrity state ölçüleri yalnız local snapshot'tan türetilir.

## No telemetry

Bu metrikler analytics endpoint'e gönderilmez. `fetch`, beacon, XHR veya WebSocket kullanılmaz.

## Diagnostics

Manifest debug sırasında kullanılabilir. Manifest içerik yedeği değildir ve ham message/prompt verisi taşımaz.

## Failure evidence

Storage unavailable veya JSON invalid state'i kullanıcı arayüzünde açıkça raporlanır. Sessiz başarı gösterilmez.

## Support

Kullanıcı bir problem bildirirken panel ekran görüntüsü ve manifest paylaşabilir; ham storage içeriği varsayılan olarak istenmez.

## Privacy

Gözlemlenebilirlik katmanı kullanıcı içeriklerini account telemetry'sine dönüştürmez.
