# Yerel Veri Merkezi — Threat Model

## Varlıklar

Sohbetler, taslaklar, istemler ve composer history kullanıcıya ait yerel içeriklerdir. Tema ve motion state daha düşük sensitivity metadata'sıdır.

## Tehdit 1 — Yanlış silme

Bir feature'ın key'i yanlış hedeflenirse kullanıcı verisi kaybolabilir. Mitigation: immutable allowlist ve explicit confirmation.

## Tehdit 2 — Sınırsız okuma

Çok büyük storage değeri UI performansını veya belleği etkileyebilir. Mitigation: 1.5 MB bounded read ve kesilmiş değer parse etmeme.

## Tehdit 3 — Manifest sızıntısı

Teknik rapor hassas içerik taşımamalıdır. Mitigation: metadata-only schema.

## Tehdit 4 — DOM injection

Storage içeriği HTML olarak yorumlanırsa script injection riski oluşur. Mitigation: `textContent` ve native DOM nodes.

## Tehdit 5 — Unknown key erasure

Gelecekteki feature key'lerinin otomatik silinmesi veri kaybına yol açabilir. Mitigation: unknown keys read-only discovery.

## Tehdit 6 — Remote exfiltration

Data center istemeden network'e dönüşebilir. Mitigation: no fetch/XHR/WebSocket/beacon kontratı.

## Tehdit 7 — Cross-tab race

Başka sekmede state değişebilir. Mitigation: storage event sonrası snapshot refresh; mutation için yine explicit action gerekir.

## Tehdit 8 — Shared browser profile

Yerel storage hesap güvenliği değildir. Mitigation: module authentication boundary'yi değiştirmez ve shared profile için yanlış güvenlik iddiası yapmaz.
