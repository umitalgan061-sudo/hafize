# Koleksiyon Uyumluluk Matrisi

## Chromium

LocalStorage, MutationObserver, FileReader, Blob ve object URL API'leri mevcut modern tarayıcılarla uyumludur.

## Firefox

Select, FileReader ve object URL akışları standart Web API'lere dayanır. Module bir bundler gerektirmez.

## Safari

`crypto.randomUUID` bulunmazsa timestamp + random fallback kullanılır.

Klavye kısayolu Meta tuşunu destekler; editable alanlarda engellenir.

## PWA

Shell cache'e koleksiyon CSS ve JS eklenmesi offline shell yüklemesini korur.

API path'leri koleksiyon dosyalarından etkilenmez.

## Eski prompt verisi

Collection map bulunmuyorsa boş map kullanılır. Koleksiyon storage'ı bulunmuyorsa panel boş durumda açılır.

Bu, Prompt Library v1 kayıtlarını migrate etmeyi zorunlu kılmaz.

## Bozuk storage

Geçersiz JSON parse edilemezse fallback boş koleksiyon listesi kullanılır.

Yanlış tipte assignment map varsa boş nesne kullanılır.

## Büyük veri

Koleksiyon sayısı 24 ile, assignment map bounded girişlerle sınırlanır. Sayım prompt listesinin mevcut bounded 120 kaydından türetilir.

## Browser matrix

| Alan | Chromium | Firefox | Safari |
|---|---|---|---|
| UI mount | Destek | Destek | Destek |
| localStorage | Destek | Destek | Destek |
| export | Destek | Destek | Destek |
| import | Destek | Destek | Destek |
| kısayol | Destek | Destek | Destek |
