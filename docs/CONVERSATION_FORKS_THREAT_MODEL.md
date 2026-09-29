# Konuşma Dalları Tehdit Modeli

## Varlıklar
Yerel conversation geçmişi, message content, fork metadata ve UI state.

## Tehditler
- DOM injection üzerinden user content ile UI bozulması.
- Malformed localStorage ile beklenmedik state.
- Fork cycle oluşturularak sonsuz parent traversal.
- Capacity overflow ile veri kaybı.
- Streaming partial response'un sabitlenmesi.
- Fork eylemi üzerinden istemsiz network request.

## Kontroller
textContent, normalize edilmiş bounded alanlar, seen set ile cycle kontrolü, hard limits, aria-busy guard ve network-free module.

## Güven sınırı
Browser localStorage trusted server data kabul edilmez. Her fork işlemi tekrar normalize edilmiş input üzerinden yürür.
