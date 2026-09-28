# Tekrar Planlama Review

## Güvenlik

- Duplicate doğrudan fetch yapmıyor.
- Row dataset'inde credential/token tutulmuyor.
- Yeni zaman en az +5 dakika ileri alınıyor.
- Son onay yine schedule workspace POST handler'ına bırakılıyor.

## UX

- Desteklenen durumlar net.
- Çalışıyor görevler hariç tutuluyor.
- Form değerleri kullanıcıya gösteriliyor.
- Preview tekrar doğrulama yapıyor.

## Regresyon

- Render sonrası düğme bir kez ekleniyor.
- PWA asset listesi güncel.
- Typed source metadata üretiyor.
- Mevcut schedule GET/POST/DELETE testleri korunuyor.
