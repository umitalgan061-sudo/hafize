# Yerel Veri Filtresi

## Arama

Arama kutusu yalnız registry metadata'sında çalışır: label, açıklama ve storage key. Ham storage içeriği full-text index edilmez.

## Kategori

Alanlar sohbet, taslak, istem, history ve tercih gruplarına ayrılır.

## Dolu alanlar

`Yalnız dolu alanlar` seçeneği storage değeri bulunmayan alanları görünümden çıkarır.

## Güvenlik

Filter sonucu sadece görünürlük değiştirir. Hiçbir storage mutation tetiklemez.

## Lifecycle

Data center yeniden render olduğunda MutationObserver filtreleri tekrar uygular. Destroy sonrası observer kaldırılır.

## Accessibility

Search `type=search`; select ve checkbox ayrı label'larla erişilebilir.

## Mobile

Dar viewport'ta kontroller tek kolona düşer.
